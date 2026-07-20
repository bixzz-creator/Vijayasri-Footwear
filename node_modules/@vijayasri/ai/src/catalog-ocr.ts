import { GoogleGenAI } from '@google/genai';
import { OPENROUTER_VISION_MODEL_CANDIDATES, DEFAULT_OPENROUTER_VISION_MODEL } from './providers/openrouter';
import { parseJsonFromModelText } from './prompts/footwear-analysis';
import { parseCatalogOcrText } from './catalog-text-parser';
import { extractTextWithOcrSpaceStrict } from './providers/ocr-space';
import type { AIEngine } from './config';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

export const CATALOG_OCR_PROMPT = `You are an expert OCR system for Indian footwear catalog/packaging photos (Walkaroo, Paragon, VKC, etc.).

Read ALL printed text on the image — brand banner, Art Number, color name, MRP price, size chart labels.

Extract and return JSON ONLY (no markdown):
{
  "brand": "Walkaroo or Paragon etc.",
  "artNumber": "Model/Art code e.g. W187, BX2554, WL7900 — empty string if not found",
  "color": "Primary color e.g. Maroon, Blue, French Beige",
  "price": integer MRP from catalog (e.g. 189, 299, 359) or null,
  "gender": "Men" | "Women" | "Kids" | "Unisex",
  "category": "Sandals" | "Flip-Flops" | "Slides" | "Casual Slippers" | "Sports Slides" | "Bathroom Slippers"
}

Rules:
- Art Number is often labeled "Art Number" or printed as codes like BX2554, W187, WL7900.
- Price is the MRP in rupees (usually 99–999).
- BX/WL/W codes often indicate Women; infer gender from catalog text or art number.
- Read the bottom catalog strip carefully — that is where Art Number, color, and price usually appear.`;

export interface CatalogOcrResult {
  brand: string;
  artNumber: string;
  color: string;
  price: number | null;
  gender: string;
  category: string;
}

function extractMessageText(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('OpenRouter returned an empty response.');
  }
  const d = data as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    error?: { message?: string };
  };
  if (d.error?.message) throw new Error(d.error.message);
  const content = d.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter(p => p.type === 'text' && p.text).map(p => p.text!).join('\n');
  }
  throw new Error('OpenRouter response had no text content.');
}

export async function extractCatalogMetadataOpenRouter(
  apiKey: string,
  imageBase64: string,
  modelId?: string,
  referer = 'https://vijayasri-footwear.local'
): Promise<CatalogOcrResult> {
  const url = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const candidates = [
    modelId?.trim() || DEFAULT_OPENROUTER_VISION_MODEL,
    ...OPENROUTER_VISION_MODEL_CANDIDATES,
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  let lastError = '';

  for (const model of candidates) {
    try {
      const response = await fetch(OPENROUTER_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
          'X-Title': 'VijayaSri Footwear Catalog OCR',
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: `${CATALOG_OCR_PROMPT}\n\nRespond with ONLY valid JSON.` },
              { type: 'image_url', image_url: { url } },
            ],
          }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = (payload as { error?: { message?: string } }).error?.message ?? response.statusText;
        continue;
      }

      const parsed = parseJsonFromModelText(extractMessageText(payload)) as Record<string, unknown>;
      return {
        brand: String(parsed.brand ?? 'Walkaroo'),
        artNumber: String(parsed.artNumber ?? parsed.model ?? '').trim(),
        color: String(parsed.color ?? 'Standard'),
        price: typeof parsed.price === 'number' ? parsed.price : typeof parsed.mrp === 'number' ? parsed.mrp : null,
        gender: String(parsed.gender ?? 'Unisex'),
        category: String(parsed.category ?? 'Casual Slippers'),
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`OpenRouter catalog OCR failed: ${lastError || 'All models unavailable.'}`);
}

function parseCatalogOcrJson(parsed: Record<string, unknown>): CatalogOcrResult {
  return {
    brand: String(parsed.brand ?? 'Walkaroo'),
    artNumber: String(parsed.artNumber ?? parsed.model ?? '').trim(),
    color: String(parsed.color ?? 'Standard'),
    price: typeof parsed.price === 'number' ? parsed.price : typeof parsed.mrp === 'number' ? parsed.mrp : null,
    gender: String(parsed.gender ?? 'Unisex'),
    category: String(parsed.category ?? 'Casual Slippers'),
  };
}

export async function extractCatalogMetadataGemini(
  apiKey: string,
  imageBase64: string,
  modelId = 'gemini-2.5-flash'
): Promise<CatalogOcrResult> {
  const ai = new GoogleGenAI({ apiKey });
  const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [
      `${CATALOG_OCR_PROMPT}\n\nRespond with ONLY valid JSON.`,
      { inlineData: { data, mimeType } },
    ],
    config: { responseMimeType: 'application/json' },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini catalog OCR returned an empty response.');
  return parseCatalogOcrJson(parseJsonFromModelText(text) as Record<string, unknown>);
}

export async function extractCatalogMetadataOcrSpace(
  apiKey: string,
  imageBase64: string
): Promise<CatalogOcrResult> {
  const text = await extractTextWithOcrSpaceStrict(apiKey, imageBase64);
  const parsed = parseCatalogOcrText(text);
  return {
    brand: parsed.brand,
    artNumber: parsed.artNumber ?? '',
    color: parsed.color,
    price: parsed.price,
    gender: parsed.gender,
    category: parsed.category,
  };
}

export async function extractCatalogMetadata(
  provider: AIEngine,
  apiKey: string,
  imageBase64: string,
  modelId?: string
): Promise<CatalogOcrResult> {
  if (provider === 'ocrspace') {
    return extractCatalogMetadataOcrSpace(apiKey, imageBase64);
  }
  if (provider === 'gemini') {
    return extractCatalogMetadataGemini(apiKey, imageBase64, modelId);
  }
  if (provider === 'bytez') {
    throw new Error('Bytez catalog OCR is not supported. Use OCR.space API key.');
  }
  return extractCatalogMetadataOpenRouter(apiKey, imageBase64, modelId);
}
