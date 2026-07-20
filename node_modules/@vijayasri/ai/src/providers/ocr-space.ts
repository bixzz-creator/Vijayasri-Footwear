import { AIProvider, AIAnalysisResult } from '../types';
import { recommendPrice } from './mock';
import { normalizeBrandAndModel } from '@vijayasri/database';
import { parseCatalogOcrText } from '../catalog-text-parser';

const OCR_SPACE_API = 'https://api.ocr.space/parse/image';
/** Public sample image used only for API-key connection tests. */
const OCR_SPACE_PROBE_URL = 'https://dl.a9t9.com/ocrbenchmark/eng.png';

export interface OcrSpaceResponse {
  ParsedResults?: Array<{ ParsedText?: string; FileParseExitCode?: number }>;
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
}

function formatOcrError(payload: OcrSpaceResponse, fallback: string): string {
  if (Array.isArray(payload.ErrorMessage)) {
    return payload.ErrorMessage.join('; ') || fallback;
  }
  return String(payload.ErrorMessage ?? fallback);
}

function throwIfOcrFailed(payload: OcrSpaceResponse, response: Response): void {
  if (!response.ok) {
    throw new Error(formatOcrError(payload, `OCR.space HTTP ${response.status}`));
  }

  if (payload.IsErroredOnProcessing) {
    const msg = formatOcrError(payload, 'OCR.space processing error');
    if (/E550|E201|E202|api.?key|invalid free/i.test(msg)) {
      throw new Error(
        `Invalid OCR.space API key (${msg}). Confirm the key from your OCR.space email, verify your account, or request a new free key at ocr.space/OCRAPI.`
      );
    }
    throw new Error(msg);
  }
}

function detectImageMeta(imageBase64: string): { dataUrl: string; filetype: string } {
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (match) {
    const mime = match[1].toLowerCase();
    const raw = match[2].replace(/\s/g, '');
    const filetype =
      mime.includes('png') ? 'PNG' :
      mime.includes('gif') ? 'GIF' :
      mime.includes('bmp') ? 'BMP' :
      mime.includes('tif') ? 'TIF' :
      'JPG';
    return { dataUrl: `data:${mime};base64,${raw}`, filetype };
  }

  const raw = imageBase64.replace(/\s/g, '');
  return { dataUrl: `data:image/jpeg;base64,${raw}`, filetype: 'JPG' };
}

async function postOcrSpace(apiKey: string, form: FormData): Promise<OcrSpaceResponse> {
  const cleanKey = (apiKey || '').replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').replace(/[^\x20-\x7E]/g, '').trim();
  // OCR.space expects multipart form fields; do not set Content-Type manually.
  form.set('apikey', cleanKey);
  form.set('language', form.get('language')?.toString() || 'eng');
  form.set('isOverlayRequired', form.get('isOverlayRequired')?.toString() || 'false');

  const response = await fetch(OCR_SPACE_API, {
    method: 'POST',
    headers: { apikey: cleanKey },
    body: form,
  });

  const payload = (await response.json().catch(() => ({}))) as OcrSpaceResponse;
  throwIfOcrFailed(payload, response);
  return payload;
}

/** Read text from a catalog image using OCR.space (https://ocr.space/OCRAPI). */
export async function extractTextWithOcrSpace(
  apiKey: string,
  imageBase64: string
): Promise<string> {
  const { dataUrl, filetype } = detectImageMeta(imageBase64);
  const form = new FormData();
  form.set('base64Image', dataUrl);
  form.set('filetype', filetype);
  form.set('OCREngine', '2');
  form.set('detectOrientation', 'true');
  form.set('scale', 'true');

  const payload = await postOcrSpace(apiKey, form);
  return payload.ParsedResults?.[0]?.ParsedText?.trim() ?? '';
}

/**
 * Verify OCR.space API key using their public sample image URL.
 * Avoids tiny/mismatched local test images that trigger E505.
 */
export async function validateOcrSpaceApiKey(apiKey: string): Promise<void> {
  const form = new FormData();
  form.set('url', OCR_SPACE_PROBE_URL);
  form.set('OCREngine', '2');
  form.set('filetype', 'PNG');

  await postOcrSpace(apiKey, form);
}

export async function extractTextWithOcrSpaceStrict(
  apiKey: string,
  imageBase64: string
): Promise<string> {
  const text = await extractTextWithOcrSpace(apiKey, imageBase64);
  if (!text) {
    throw new Error('OCR.space returned no text. Check image quality or API key.');
  }
  return text;
}

function buildAnalysisFromOcrText(
  text: string,
  mrpRulePercentage: number,
  mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
): AIAnalysisResult {
  const parsed = parseCatalogOcrText(text);
  const artNumber = parsed.artNumber ?? 'Unknown';
  const mrp = parsed.price ?? 499;
  const normalized = normalizeBrandAndModel(parsed.brand, artNumber, `${parsed.brand} ${artNumber}`);
  const gender = parsed.gender as AIAnalysisResult['gender'];
  const category = parsed.category.replace(/_/g, ' ');

  return {
    name: normalized.name,
    brand: normalized.brand,
    model: normalized.model || artNumber,
    gender,
    category,
    material: 'PU Footwear',
    mrp,
    offer_price: recommendPrice(mrp, mrpRulePercentage, mrpRoundingRule),
    description: `${parsed.brand} ${category} in ${parsed.color}. Catalog OCR read from packaging.`,
    features: [
      'Comfort footbed for daily wear',
      'Lightweight design',
      'Durable outsole',
    ],
    tags: [parsed.brand.toLowerCase(), category.toLowerCase(), parsed.color.toLowerCase(), gender.toLowerCase()],
    collections: gender === 'Men' ? ['Men\'s Collection'] : gender === 'Women' ? ['Women\'s Collection'] : ['Daily Wear'],
    color: parsed.color,
    sizes: gender === 'Kids' ? [1, 2, 3, 4, 5] : gender === 'Women' ? [4, 5, 6, 7, 8] : [6, 7, 8, 9, 10],
    aiConfidence: parsed.artNumber && parsed.price && parsed.color !== 'Standard' ? 92 : parsed.artNumber && parsed.price ? 85 : 72,
    aiAnalysisDetails: {
      brandStatus: parsed.brand !== 'Walkaroo' ? 'exact' : 'exact',
      modelStatus: parsed.artNumber ? 'certain' : 'uncertain',
      categoryStatus: parsed.artNumber ? 'certain' : 'uncertain',
      materialStatus: 'uncertain',
    },
  };
}

export class OcrSpaceAIProvider implements AIProvider {
  readonly providerLabel = 'OCR.space';

  constructor(private apiKey: string) {}

  async analyzeImages(
    imagesBase64: string[],
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<AIAnalysisResult> {
    if (imagesBase64.length === 0) {
      throw new Error('No images provided for OCR analysis.');
    }

    let combinedText = '';
    for (const img of imagesBase64.slice(0, 2)) {
      const text = await extractTextWithOcrSpaceStrict(this.apiKey, img);
      combinedText += `\n${text}`;
    }

    return buildAnalysisFromOcrText(combinedText, mrpRulePercentage, mrpRoundingRule);
  }
}

/** Lightweight connection test against OCR.space public sample image. */
export async function testOcrSpaceConnection(apiKey: string): Promise<void> {
  await validateOcrSpaceApiKey(apiKey);
}
