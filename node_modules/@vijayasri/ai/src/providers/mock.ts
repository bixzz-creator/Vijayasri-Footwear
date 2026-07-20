import { AIProvider, AIAnalysisResult } from '../types';

export function recommendPrice(
  mrp: number,
  discountPercent: number,
  roundingRule: 'none' | 'nearest-9' | 'nearest-5'
): number {
  const rawPrice = mrp * (1 - discountPercent / 100);
  if (roundingRule === 'none') return Math.round(rawPrice);
  if (roundingRule === 'nearest-9') {
    const rounded = Math.round(rawPrice / 10) * 10;
    return rounded - 1; // E.g., 764 -> 760 -> 759
  }
  if (roundingRule === 'nearest-5') {
    return Math.round(rawPrice / 5) * 5; // E.g., 762 -> 760
  }
  return Math.round(rawPrice);
}

const BRANDS = ['Puma', 'Sparx', 'Bata', 'Walkaroo', 'VKC Pride', 'Paragon'];
const CATEGORIES = [
  'Slippers', 'Formal Shoes', 'Casual Shoes', 'Sports Shoes', 'Running Shoes', 'Sneakers',
  'Sandals', 'Slides', 'Flip-Flops', 'Crocs', 'Loafers', 'School Shoes', 'Kids Footwear',
  'Boots', 'Safety Shoes', 'Indoor Footwear', 'Outdoor Footwear'
];
const COLORS = ['Midnight Black', 'Ocean Blue', 'Ruby Red', 'Pastel Pink', 'Forest Green', 'Slate Gray'];
const MATERIALS = ['EVA Foam', 'Natural Rubber', 'Soft Foam', 'PVC Rubber', 'Synthetic Leather'];
const MODELS = ['OGO', 'Flex', 'Classic', 'Pro', 'Lite', 'Comfort', 'Sport'];

const GENDERS = ['Men', 'Women', 'Kids', 'Unisex'] as const;

export class MockAIProvider implements AIProvider {
  async analyzeImages(
    _imagesBase64: string[],
    mrpRulePercentage: number,
    mrpRoundingRule: 'none' | 'nearest-9' | 'nearest-5'
  ): Promise<AIAnalysisResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
    const model = MODELS[Math.floor(Math.random() * MODELS.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
    const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
    
    const name = `${brand} ${model}`;
    const mrp = Math.floor(Math.random() * 6 + 3) * 100 + 99; // 399 to 899
    const offerPrice = recommendPrice(mrp, mrpRulePercentage, mrpRoundingRule);

    // Nike-style description copy
    const description = `Float through your stride. Engineered with lightweight ${material}, this premium ${category.toLowerCase().slice(0, -1)} provides responsive cushioning and maximum flexibility. Made for everyday relaxation.`;

    const features = [
      `Ultra-lightweight ${material} compound for cloud-like bounce`,
      'Contoured orthopedic footbed with anti-slip micro-textures',
      'High-traction rubber outsole protects against wet bathroom tiles',
      'Ergonomic strap reduces pressure points over the instep',
      'Water-friendly material dries within minutes of exposure'
    ];

    const tags = [
      category.toLowerCase(),
      color.toLowerCase().replace(' ', '-'),
      material.toLowerCase().replace(' ', '-'),
      gender.toLowerCase(),
      'comfortable',
      'durable'
    ];

    const collections = ['Daily Wear'];
    if (mrp >= 699) collections.push('Premium Collection');
    if (Math.random() > 0.5) collections.push('Trending');
    if (material === 'Natural Rubber' || material === 'EVA Foam') collections.push('Bathroom');

    const sizes = gender === 'Kids' ? [1, 2, 3, 4, 5] : gender === 'Women' ? [5, 6, 7, 8] : [6, 7, 8, 9, 10];

    const confidence = Math.floor(Math.random() * 20) + 80; // 80 - 99%

    return {
      name,
      brand,
      model,
      gender,
      category,
      material,
      mrp,
      offer_price: offerPrice,
      description,
      features,
      tags,
      collections,
      color,
      sizes,
      aiConfidence: confidence,
      aiAnalysisDetails: {
        brandStatus: Math.random() > 0.3 ? 'exact' : 'guessed',
        modelStatus: Math.random() > 0.5 ? 'certain' : 'absent',
        categoryStatus: 'certain',
        materialStatus: 'certain'
      }
    };
  }
}
