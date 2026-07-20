import { AIProvider, AIAnalysisResult } from '../types';
import { recommendPrice } from './mock';
import { normalizeBrandAndModel } from '@vijayasri/database';
import { FOOTWEAR_ANALYSIS_PROMPT, parseJsonFromModelText } from '../prompts/footwear-analysis';

/** Vision-capable models on OpenRouter (tried in order). */
export const OPENROUTER_VISION_MODEL_CANDIDATES = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash-preview',
  'google/gemini-flash-1.5',
  'meta-llama/llama-3.2-11b-vision-instruct',
  'qwen/qwen-2-vl-7b-instruct',
];

export const DEFAULT_OPENROUTER_VISION_MODEL = OPENROUTER_VISION_MODEL_CANDIDATES[0];

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

function extractMessageText(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('OpenRouter returned an empty response.');
  }
  const d = data as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    error?: { message?: string };
  };
  if (d.error?.message) {
    throw new Error(d.error.message);
  }
  const content = d.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(part => part.type === 'text' && part.text)
      .map(part => part.text!)
      .join('\n');
  }
  throw new Error('OpenRouter response had no text content.');
}

export class OpenRouterAIProvider implements AIProvider {
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId?: string) {
    this.apiKey = apiKey;
    this.modelId = modelId?.trim() || DEFAULT_OPENROUTER_VISION_MODEL;
  }

  get activeModelId(): string {
    return this.modelId;
  }

  async analyzeImages(
    imagesBase64: string[],
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<AIAnalysisResult> {
    if (imagesBase64.length === 0) {
      throw new Error('No images provided for AI analysis.');
    }

    const imageParts = imagesBase64.map(base64 => {
      const url = base64.startsWith('data:')
        ? base64
        : `data:image/jpeg;base64,${base64}`;
      return {
        type: 'image_url' as const,
        image_url: { url },
      };
    });

    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `${FOOTWEAR_ANALYSIS_PROMPT}\n\nRespond with ONLY valid JSON. No markdown fences.`,
          },
          ...imageParts,
        ],
      },
    ];

    const candidates = [
      this.modelId,
      ...OPENROUTER_VISION_MODEL_CANDIDATES.filter(id => id !== this.modelId),
    ];

    let lastError = '';

    for (const model of candidates) {
      try {
        const cleanKey = (this.apiKey || '').replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').replace(/[^\x20-\x7E]/g, '').trim();
        const response = await fetch(OPENROUTER_API, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://vijayasri-footwear.local',
            'X-Title': 'VijayaSri Footwear Admin',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = (payload as { error?: { message?: string } }).error?.message
            ?? response.statusText;
          lastError = errMsg;
          console.warn(`[OpenRouter] Model ${model} failed: ${errMsg}`);
          continue;
        }

        const text = extractMessageText(payload);
        const parsed = parseJsonFromModelText(text) as AIAnalysisResult & { model?: string };
        const normalized = normalizeBrandAndModel(parsed.brand, parsed.model ?? '', parsed.name);

        if (model !== this.modelId) {
          console.log(`[OpenRouter] Using fallback model: ${model}`);
          this.modelId = model;
        }

        const result: AIAnalysisResult = {
          ...parsed,
          brand: normalized.brand,
          model: normalized.model,
          name: normalized.name,
          offer_price: 0,
        };
        result.offer_price = recommendPrice(result.mrp, mrpRulePercentage, mrpRoundingRule);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenRouter] Model ${model} error: ${lastError}`);
      }
    }

    throw new Error(`OpenRouter vision failed: ${lastError || 'All models unavailable.'}`);
  }
}
