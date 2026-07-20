import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIAnalysisResult } from '../types';
import { recommendPrice } from './mock';
import { normalizeBrandAndModel } from '@vijayasri/database';
import { FOOTWEAR_ANALYSIS_PROMPT, parseJsonFromModelText } from '../prompts/footwear-analysis';

export class GeminiAIProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeImages(
    imagesBase64: string[],
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<AIAnalysisResult> {
    if (imagesBase64.length === 0) {
      throw new Error('No images provided for AI analysis.');
    }

    const systemPrompt = FOOTWEAR_ANALYSIS_PROMPT;

    const imageParts = imagesBase64.map(base64 => {
      const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const data = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      return {
        inlineData: {
          data,
          mimeType
        }
      };
    });

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        systemPrompt,
        ...imageParts
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini response was empty.');
    }

    const parsed = parseJsonFromModelText(text) as AIAnalysisResult & { model?: string };
    const normalized = normalizeBrandAndModel(parsed.brand, parsed.model ?? '', parsed.name);

    const result: AIAnalysisResult = {
      ...parsed,
      brand: normalized.brand,
      model: normalized.model,
      name: normalized.name,
      offer_price: 0,
    };

    // Adjust offer price based on the rules passed in
    result.offer_price = recommendPrice(result.mrp, mrpRulePercentage, mrpRoundingRule);

    return result;
  }
}
