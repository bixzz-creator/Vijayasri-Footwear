import { AIProvider, AIAnalysisResult } from '../types';
import { recommendPrice } from './mock';
import { normalizeBrandAndModel } from '@vijayasri/database';
import { FOOTWEAR_ANALYSIS_PROMPT, parseJsonFromModelText } from '../prompts/footwear-analysis';

/** Vision models known to support image-text-to-text on Bytez (tried in order). */
export const BYTEZ_VISION_MODEL_CANDIDATES = [
  'meta-llama/Llama-3.2-11B-Vision-Instruct',
  'Qwen/Qwen2-VL-7B-Instruct',
  'microsoft/Phi-3.5-vision-instruct',
  'google/gemma-3-27b-it',
  'google/gemma-3-4b-it',
];

export const DEFAULT_BYTEZ_VISION_MODEL = BYTEZ_VISION_MODEL_CANDIDATES[0];

function bytezModelUrl(modelId: string): string {
  const path = modelId.split('/').map(encodeURIComponent).join('/');
  return `https://api.bytez.com/models/v2/${path}`;
}

function extractOutputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (!output || typeof output !== 'object') {
    throw new Error('Bytez returned an empty response.');
  }
  const o = output as Record<string, unknown>;
  if (typeof o.generated_text === 'string') return o.generated_text;
  if (typeof o.text === 'string') return o.text;
  if (typeof o.content === 'string') return o.content;
  if (Array.isArray(o.choices) && o.choices[0]) {
    const choice = o.choices[0] as Record<string, unknown>;
    const msg = choice.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === 'string') return msg.content;
  }
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return JSON.stringify(output);
}

function isModelMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('does not exist') ||
    lower.includes('not found') ||
    lower.includes('catalog') ||
    lower.includes('modelid');
}

export async function listBytezVisionModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      'https://api.bytez.com/models/v2/list/models?task=image-text-to-text',
      { headers: { Authorization: apiKey } }
    );
    const payload = await res.json().catch(() => ({}));
    const list = (payload as { output?: Array<{ modelId?: string }> }).output ?? [];
    return list.map(m => m.modelId).filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

async function runBytezVisionRequest(
  apiKey: string,
  modelId: string,
  messages: unknown[]
): Promise<string> {
  const url = bytezModelUrl(modelId);
  const bodies = [
    { messages },
    messages,
  ];

  let lastError = '';

  const cleanKey = (apiKey || '').replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').replace(/[^\x20-\x7E]/g, '').trim();
  for (const body of bodies) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: cleanKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    const err = (payload as { error?: unknown }).error;
    const errText = err
      ? (typeof err === 'string' ? err : JSON.stringify(err))
      : (!response.ok ? response.statusText : '');

    if (errText) {
      lastError = errText;
      if (isModelMissingError(errText)) {
        throw new Error(errText);
      }
      continue;
    }

    if (!response.ok) {
      lastError = response.statusText;
      continue;
    }

    const output = (payload as { output?: unknown }).output ?? payload;
    return extractOutputText(output);
  }

  throw new Error(lastError || 'Bytez vision request failed.');
}

export class BytezAIProvider implements AIProvider {
  private apiKey: string;
  private modelId: string;
  private resolvedModelId: string | null = null;

  constructor(apiKey: string, modelId?: string) {
    this.apiKey = apiKey;
    this.modelId = modelId?.trim() || DEFAULT_BYTEZ_VISION_MODEL;
  }

  get activeModelId(): string {
    return this.resolvedModelId ?? this.modelId;
  }

  private async resolveWorkingModel(): Promise<string> {
    if (this.resolvedModelId) return this.resolvedModelId;

    const candidates = [
      this.modelId,
      ...BYTEZ_VISION_MODEL_CANDIDATES.filter(id => id !== this.modelId),
    ];

    const catalog = await listBytezVisionModels(this.apiKey);
    if (catalog.length > 0) {
      const preferred = candidates.find(id => catalog.includes(id));
      if (preferred) {
        this.resolvedModelId = preferred;
        console.log(`[Bytez] Using catalog vision model: ${preferred}`);
        return preferred;
      }
      this.resolvedModelId = catalog[0];
      console.log(`[Bytez] Using first catalog vision model: ${catalog[0]}`);
      return catalog[0];
    }

    for (const candidate of candidates) {
      try {
        await runBytezVisionRequest(this.apiKey, candidate, [{
          role: 'user',
          content: [
            { type: 'text', text: 'Reply with the word OK only.' },
            {
              type: 'image',
              base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          ],
        }]);
        this.resolvedModelId = candidate;
        console.log(`[Bytez] Resolved vision model: ${candidate}`);
        return candidate;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isModelMissingError(msg)) {
          this.resolvedModelId = candidate;
          return candidate;
        }
        console.warn(`[Bytez] Model unavailable: ${candidate}`);
      }
    }

    throw new Error(
      'No Bytez vision model available. Open bytez.com/models, filter by "image-text-to-text", and set a model ID in Admin Settings.'
    );
  }

  async analyzeImages(
    imagesBase64: string[],
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<AIAnalysisResult> {
    if (imagesBase64.length === 0) {
      throw new Error('No images provided for AI analysis.');
    }

    const modelId = await this.resolveWorkingModel();

    const imageParts = imagesBase64.map(base64 => {
      const normalized = base64.startsWith('data:')
        ? base64
        : `data:image/jpeg;base64,${base64}`;
      return { type: 'image' as const, base64: normalized };
    });

    const messages = [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${FOOTWEAR_ANALYSIS_PROMPT}\n\nRespond with ONLY valid JSON. No markdown fences.`,
        },
        ...imageParts,
      ],
    }];

    const text = await runBytezVisionRequest(this.apiKey, modelId, messages);
    const parsed = parseJsonFromModelText(text) as AIAnalysisResult & { model?: string };
    const normalized = normalizeBrandAndModel(parsed.brand, parsed.model ?? '', parsed.name);

    const result: AIAnalysisResult = {
      ...parsed,
      brand: normalized.brand,
      model: normalized.model,
      name: normalized.name,
      offer_price: 0,
    };

    result.offer_price = recommendPrice(result.mrp, mrpRulePercentage, mrpRoundingRule);
    return result;
  }
}
