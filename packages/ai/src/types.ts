export interface AIAnalysisResult {
  name: string;
  brand: string;
  model: string;
  gender: 'Men' | 'Women' | 'Kids' | 'Unisex';
  category: string;
  material: string;
  mrp: number;
  offer_price: number;
  description: string;
  features: string[];
  tags: string[];
  collections: string[];
  color: string;
  sizes: number[];
  aiConfidence: number;
  aiAnalysisDetails: {
    brandStatus: 'exact' | 'guessed' | 'absent';
    modelStatus: 'certain' | 'uncertain' | 'absent';
    categoryStatus: 'certain' | 'uncertain';
    materialStatus: 'certain' | 'uncertain';
  };
}

export interface AIProvider {
  analyzeImages(
    imagesBase64: string[], // Base64 strings of the variant images
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<AIAnalysisResult>;
}
