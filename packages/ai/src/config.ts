export type AIEngine = 'ocrspace' | 'gemini' | 'bytez' | 'openrouter';

export interface AIInitOptions {
  /** OCR.space API key from https://ocr.space/OCRAPI */
  ocrApiKey?: string;
  /** @deprecated use ocrApiKey — kept for old vault entries */
  geminiApiKey?: string;
  bytezApiKey?: string;
  openRouterApiKey?: string;
  aiProvider?: AIEngine;
  bytezModelId?: string;
  openRouterModelId?: string;
}

export function resolveAIInitOptions(
  input?: string | AIInitOptions
): {
  provider: AIEngine | null;
  apiKey: string;
  bytezModelId?: string;
  openRouterModelId?: string;
} {
  if (typeof input === 'string') {
    const key = input.trim();
    return key ? { provider: 'ocrspace', apiKey: key } : { provider: null, apiKey: '' };
  }

  const ocrKey = input?.ocrApiKey?.trim() ?? input?.geminiApiKey?.trim() ?? '';
  const bytezKey = input?.bytezApiKey?.trim() ?? '';
  const openRouterKey = input?.openRouterApiKey?.trim() ?? '';
  const geminiKey = input?.geminiApiKey?.trim() ?? '';
  const preferred = input?.aiProvider;

  if (preferred === 'ocrspace' && ocrKey) {
    return { provider: 'ocrspace', apiKey: ocrKey };
  }
  if (preferred === 'gemini' && geminiKey) {
    return { provider: 'gemini', apiKey: geminiKey };
  }
  if (preferred === 'bytez' && bytezKey) {
    return { provider: 'bytez', apiKey: bytezKey, bytezModelId: input?.bytezModelId };
  }
  if (preferred === 'openrouter' && openRouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      openRouterModelId: input?.openRouterModelId,
    };
  }

  if (ocrKey) {
    return { provider: 'ocrspace', apiKey: ocrKey };
  }
  if (geminiKey) {
    return { provider: 'gemini', apiKey: geminiKey };
  }
  if (bytezKey) {
    return { provider: 'bytez', apiKey: bytezKey, bytezModelId: input?.bytezModelId };
  }
  if (openRouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      openRouterModelId: input?.openRouterModelId,
    };
  }
  return { provider: null, apiKey: '' };
}
