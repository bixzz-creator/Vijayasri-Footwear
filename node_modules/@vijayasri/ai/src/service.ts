import { AIProvider, AIAnalysisResult } from './types';
import { MockAIProvider } from './providers/mock';
import { GeminiAIProvider } from './providers/gemini';
import { BytezAIProvider } from './providers/bytez';
import { OpenRouterAIProvider } from './providers/openrouter';
import { OcrSpaceAIProvider } from './providers/ocr-space';
import { AIInitOptions, resolveAIInitOptions } from './config';
import { db, normalizeBrandAndModel } from '@vijayasri/database';
import { validateOcrSpaceApiKey } from './providers/ocr-space';

type AIEngine = 'mock' | 'ocrspace' | 'openrouter' | 'gemini' | 'bytez';

class AIService {
  private provider: AIProvider;
  private currentApiKey: string | null = null;
  private currentEngine: AIEngine = 'mock';

  constructor() {
    this.provider = new MockAIProvider();
  }

  init(options?: string | AIInitOptions) {
    const resolved = resolveAIInitOptions(options);

    if (resolved.provider === 'ocrspace' && resolved.apiKey) {
      this.provider = new OcrSpaceAIProvider(resolved.apiKey);
      this.currentApiKey = resolved.apiKey;
      this.currentEngine = 'ocrspace';
      console.log('AI Service initialized with OCR.space API.');
      return;
    }

    if (resolved.provider === 'openrouter' && resolved.apiKey) {
      this.provider = new OpenRouterAIProvider(resolved.apiKey, resolved.openRouterModelId);
      this.currentApiKey = resolved.apiKey;
      this.currentEngine = 'openrouter';
      console.log('AI Service initialized with OpenRouter Vision API.');
      return;
    }

    if (resolved.provider === 'bytez' && resolved.apiKey) {
      this.provider = new BytezAIProvider(resolved.apiKey, resolved.bytezModelId);
      this.currentApiKey = resolved.apiKey;
      this.currentEngine = 'bytez';
      console.log('AI Service initialized with Bytez Vision API.');
      return;
    }

    if (resolved.provider === 'gemini' && resolved.apiKey) {
      this.provider = new GeminiAIProvider(resolved.apiKey);
      this.currentApiKey = resolved.apiKey;
      this.currentEngine = 'gemini';
      console.log('AI Service initialized with Google Gemini API.');
      return;
    }

    this.provider = new MockAIProvider();
    this.currentApiKey = null;
    this.currentEngine = 'mock';
    console.log('AI Service initialized in Demo Mode (Mock AI).');
  }

  get mode(): AIEngine {
    return this.currentEngine;
  }

  get isLive(): boolean {
    return this.currentEngine !== 'mock';
  }

  get activeModelLabel(): string | null {
    if (this.provider instanceof OcrSpaceAIProvider) return 'OCR.space Engine 2';
    if (this.provider instanceof OpenRouterAIProvider) return this.provider.activeModelId;
    if (this.provider instanceof BytezAIProvider) return this.provider.activeModelId;
    if (this.currentEngine === 'gemini') return 'gemini-2.5-flash';
    return null;
  }

  async analyzeSlipper(
    compositeHash: string,
    imagesBase64: string[],
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<{ result: AIAnalysisResult; fromCache: boolean }> {
    const cached = await this.checkCache(compositeHash);
    if (cached) {
      console.log(`[AI Cache Hit] Reused cached metadata for hash: ${compositeHash}`);
      return { result: cached, fromCache: true };
    }

    console.log(`[AI Cache Miss] Calling AI provider (${this.mode}) for hash: ${compositeHash}`);
    const result = await this.provider.analyzeImages(
      imagesBase64,
      mrpRulePercentage,
      mrpRoundingRule
    );

    return { result, fromCache: false };
  }

  async analyzeFootwearImages(
    imagesBase64: string[],
    mrpRulePercentage = 15,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5' = 'nearest-9'
  ): Promise<AIAnalysisResult> {
    const res = await this.analyzeSlipper(
      'temp-verification-hash-' + Math.random(),
      imagesBase64,
      mrpRulePercentage,
      mrpRoundingRule
    );
    return res.result;
  }

  async extractOCR(imagesBase64: string[]): Promise<{ text: string }> {
    if (imagesBase64.length === 0) return { text: '' };

    if (this.isLive) {
      const result = await this.analyzeFootwearImages(imagesBase64, 0, 'none');
      return {
        text: `${result.brand} ${result.model} ${result.color} MRP ${result.mrp} ${result.gender} ${result.category}`,
      };
    }

    return { text: 'Demo Mode OCR: VijayaSri Comfort Slipper Size 8 MRP 499' };
  }

  async generateMetadata(imagesBase64: string[]): Promise<{ brand: string; color: string; material: string }> {
    const result = await this.analyzeFootwearImages(imagesBase64);
    return {
      brand: result.brand,
      color: result.color,
      material: result.material,
    };
  }

  async generateSEO(productName: string, category: string): Promise<{
    seoTitle: string;
    seoDescription: string;
    metaKeywords: string[];
    altText: string;
  }> {
    const seoTitle = `${productName} | VijayaSri Footwear`;
    const seoDescription = `Shop the latest premium ${category} - ${productName}. Crafted for maximum comfort, lightweight wear, and elegant styling. Free store pickup available.`;
    const metaKeywords = [category.toLowerCase(), productName.toLowerCase(), 'vijayasri footwear', 'comfort slippers', 'coimbatore shop'];
    const altText = `Product image of ${productName} - premium ${category}`;
    return { seoTitle, seoDescription, metaKeywords, altText };
  }

  private async checkCache(hash: string): Promise<AIAnalysisResult | null> {
    try {
      const products = await db.getProducts();
      for (const p of products) {
        const matchingVariant = p.variants?.find((v: any) => v.composite_hash === hash);
        if (matchingVariant) {
          const normalized = normalizeBrandAndModel(p.brandName, '', p.name);
          return {
            name: normalized.name,
            brand: normalized.brand,
            model: normalized.model,
            gender: p.gender,
            category: p.category,
            material: p.material,
            mrp: p.mrp,
            offer_price: p.offer_price,
            description: p.description,
            features: p.features,
            tags: p.tags,
            collections: p.collections,
            color: matchingVariant.color,
            sizes: matchingVariant.sizes?.map((s: any) => s.size_number) || [],
            aiConfidence: p.ai_confidence_score,
            aiAnalysisDetails: p.ai_analysis_details,
          };
        }
      }
    } catch (err) {
      console.error('Error querying cache in AIService:', err);
    }
    return null;
  }
}

export const ai = new AIService();
export default ai;
