export const GENERIC_BRAND_NAME = 'Generic';

/** Known footwear brands — longest names first for prefix matching. */
export const KNOWN_FOOTWEAR_BRANDS = [
  'VKC Pride',
  'New Balance',
  'Under Armour',
  'Red Tape',
  'VKC',
  'Walkaroo',
  'Paragon',
  'Nike',
  'Puma',
  'Crocs',
  'Adidas',
  'Reebok',
  'Bata',
  'Sparx',
  'Woodland',
  'Liberty',
  'Relaxo',
  'Skechers',
  'Fila',
  'Asics',
  'Converse',
  'Metro',
  'Flite',
  'Action',
  'Campus',
  'Lancer',
  'Caprice',
  'Furo',
  'Happenstance',
  'Lee Cooper',
  'North Star',
  'Power',
].filter((v, i, a) => a.indexOf(v) === i)
  .sort((a, b) => b.length - a.length);

export interface NormalizedBrandModel {
  brand: string;
  model: string;
  name: string;
  rawBrand: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split a combined string like "Walkaroo OGO" into brand + model. */
export function splitCombinedBrandString(combined: string): { brand: string; model: string } {
  const trimmed = combined.trim();
  if (!trimmed) return { brand: '', model: '' };

  for (const known of KNOWN_FOOTWEAR_BRANDS) {
    if (trimmed.toLowerCase() === known.toLowerCase()) {
      return { brand: known, model: '' };
    }
    const prefix = new RegExp(`^${escapeRegExp(known)}\\s+(.+)$`, 'i');
    const match = trimmed.match(prefix);
    if (match) {
      return { brand: known, model: match[1].trim() };
    }
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return { brand: parts[0], model: parts.slice(1).join(' ') };
  }
  return { brand: trimmed, model: '' };
}

/** Build catalog display name from normalized brand + model. */
export function buildImportProductName(brand: string, model: string, fallbackName: string): string {
  const hasRealBrand = brand !== GENERIC_BRAND_NAME;
  if (hasRealBrand && model) return `${brand} ${model}`;
  if (hasRealBrand) return brand;
  if (fallbackName.trim()) return fallbackName.trim();
  if (model) return model;
  return 'Footwear Product';
}

/**
 * Normalize Gemini brand/model fields.
 * "Walkaroo OGO" → brand Walkaroo, model OGO, name "Walkaroo OGO"
 */
export function normalizeBrandAndModel(
  rawBrand?: string | null,
  rawModel?: string | null,
  rawName?: string | null
): NormalizedBrandModel {
  let brand = (rawBrand ?? '').trim();
  let model = (rawModel ?? '').trim();
  const nameInput = (rawName ?? '').trim();
  const rawBrandLabel = brand || '(none)';

  if (brand && !model) {
    const split = splitCombinedBrandString(brand);
    brand = split.brand;
    model = split.model;
  } else if (brand && model && brand.toLowerCase().includes(model.toLowerCase()) && brand.includes(' ')) {
    const split = splitCombinedBrandString(brand);
    if (split.model.toLowerCase() === model.toLowerCase()) {
      brand = split.brand;
    }
  }

  brand = normalizeImportBrandName(brand);
  const name = buildImportProductName(brand, model, nameInput);

  return { brand, model, name, rawBrand: rawBrandLabel };
}

/** Normalize Gemini brand output; empty/unknown → Generic. Never store combined brand+model. */
export function normalizeImportBrandName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return GENERIC_BRAND_NAME;
  }
  const { brand } = splitCombinedBrandString(trimmed);
  const normalized = brand.trim();
  if (!normalized || normalized.toLowerCase() === 'unknown') {
    return GENERIC_BRAND_NAME;
  }
  return normalized;
}

export function buildBrandSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'generic';
}

/** Category is a plain string column (no FK). Ensure a non-empty value. */
export function sanitizeImportCategory(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed || 'Slippers';
}

/** Collections are name strings in product_collections (no FK). Strip empties. */
export function sanitizeImportCollections(raw: string[] | null | undefined): string[] {
  if (!raw?.length) return [];
  return raw
    .map(c => (typeof c === 'string' ? c.trim() : String(c).trim()))
    .filter(c => c.length > 0);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, field: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`[Importer] ${field} must be a UUID, got: ${value}`);
  }
}

export function logImporterBrandResolution(
  detectedRaw: string | null | undefined,
  normalizedBrand: string,
  model: string,
  brandId: string,
  found: boolean,
  created: boolean
): void {
  console.log('[Importer]');
  console.log(`Brand detected: ${detectedRaw?.trim() ? detectedRaw.trim() : '(none)'}`);
  console.log(`Brand normalized: ${normalizedBrand}`);
  if (model) {
    console.log(`Model: ${model}`);
  }
  if (found) {
    console.log('Brand found: true');
  }
  if (created) {
    console.log('Brand created: true');
  }
  console.log(`Brand UUID: ${brandId}`);
}

export function logImporterBranchResolution(branchId: string, found: boolean, created: boolean): void {
  if (found) {
    console.log(`[Importer] Branch found: ${branchId}`);
  }
  if (created) {
    console.log(`[Importer] Branch created: ${branchId}`);
  }
}

/** Bulk catalog import without Gemini — metadata shape matches AI analysis output. */
export interface CatalogImportMetadata {
  brand: string;
  model: string;
  name: string;
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

const KNOWN_COLORS = [
  'black', 'white', 'blue', 'red', 'brown', 'grey', 'gray', 'green', 'yellow',
  'orange', 'pink', 'purple', 'beige', 'tan', 'navy', 'maroon', 'gold', 'silver',
  'cream', 'olive', 'wine', 'mustard', 'peach', 'turquoise', 'cyan', 'magenta',
];

const DEFAULT_CATALOG_PRICE = 499;
const DEFAULT_CATALOG_MATERIAL = 'PU Footwear';

export type CatalogGender = 'Men' | 'Women' | 'Kids' | 'Unisex';

const CATEGORY_ALIASES: Record<string, string> = {
  sandals: 'Sandals',
  sandal: 'Sandals',
  flip_flops: 'Flip-Flops',
  flipflops: 'Flip-Flops',
  flip: 'Flip-Flops',
  casual_slippers: 'Casual Slippers',
  casual: 'Casual Slippers',
  slippers: 'Casual Slippers',
  sports_slides: 'Sports Slides',
  sports: 'Sports Slides',
  bathroom_slippers: 'Bathroom Slippers',
  bathroom: 'Bathroom Slippers',
  slides: 'Slides',
  formal_shoes: 'Formal Shoes',
  formal: 'Formal Shoes',
  casual_shoes: 'Casual Shoes',
  sports_shoes: 'Sports Shoes',
  sneakers: 'Sneakers',
  running_shoes: 'Running Shoes',
  running: 'Running Shoes',
  crocs: 'Crocs',
  kids_footwear: 'Kids Footwear',
};

/** Infer Men / Women / Unisex from Walkaroo-style art numbers and optional OCR text. */
export function inferGenderFromArtNumber(
  artNumber: string,
  ocrText?: string
): CatalogGender {
  const text = (ocrText ?? '').toLowerCase();
  if (/\b(women|woman|ladies|lady|girls|female)\b/.test(text)) return 'Women';
  if (/\b(men|man|gents|gentlemen|boys|male)\b/.test(text)) return 'Men';
  if (/\b(kids|kid|junior|children|child|infant)\b/.test(text)) return 'Kids';
  if (/\bunisex\b/.test(text)) return 'Unisex';

  const sizeMatch = (ocrText ?? '').match(/\b(\d{1,2})\s*[xX×]\s*(\d{1,2})\b/);
  if (sizeMatch) {
    const low = parseInt(sizeMatch[1], 10);
    const high = parseInt(sizeMatch[2], 10);
    if (!Number.isNaN(low) && !Number.isNaN(high) && low <= high) {
      if (high <= 5 || (high <= 6 && low <= 2)) return 'Kids';
      if (low >= 6 || (low >= 5 && high >= 10)) return 'Men';
      if (low <= 4 && high <= 9) return 'Women';
      if (low >= 3 && high <= 8) return 'Women';
    }
  }

  const art = artNumber.toUpperCase().trim();
  if (!art) return 'Unisex';

  if (/^BX/.test(art)) return 'Women';
  if (/^WLR|^WLP|^WL/.test(art)) return 'Women';
  if (/^WF|^WC|^WE|^WES|^FLR/.test(art)) return 'Women';
  if (/^W\d{2,4}[A-Z]?$/.test(art)) return 'Women';
  if (/^M[LRS]?/.test(art) || /^M\d/.test(art)) return 'Men';
  if (/^K\d|^KIDS/.test(art)) return 'Kids';
  if (/^17\d{3}$/.test(art) || /^16\d{3}$/.test(art)) return 'Men';

  return 'Unisex';
}

/** Infer footwear category from art number and catalog OCR hints. */
export function inferCategoryFromCatalog(
  artNumber: string,
  ocrText?: string,
  gender?: CatalogGender
): string {
  const text = (ocrText ?? '').toUpperCase();
  const art = artNumber.toUpperCase().trim();

  if (/FORMAL|LOAFER|OXFORD|DERBY|BROGUE|MOCCASIN|DRESS\s*SHOE/.test(text)) return 'Formal Shoes';
  if (/SNEAKER|RUNNING|TRAINER|SPORTS\s*SHOE/.test(text)) return 'Sports Shoes';
  if (/CASUAL\s*SHOE/.test(text)) return 'Casual Shoes';
  if (/FLIP.?FLOP|HAWAII|THONG/.test(text)) return 'Flip-Flops';
  if (/BATH.?ROOM|BATH\b/.test(text)) return 'Bathroom Slippers';
  if (/SPORT/.test(text)) return 'Sports Slides';
  if (/SANDAL|BUCKLE|TOE.?LOOP|STRAP/.test(text)) return 'Sandals';
  if (/SLIDE/.test(text)) return 'Slides';
  if (/\bSHOE\b/.test(text) && !/SLIPPER|FLIP|SANDAL/.test(text)) return 'Formal Shoes';

  if (/^17\d{3}$/.test(art) || /^16\d{3}$/.test(art)) return 'Formal Shoes';
  if (/^W\d{2,4}[A-Z]?$/.test(art)) return 'Flip-Flops';
  if (/^BX/.test(art)) return 'Sandals';
  if (/^WLR|^WLP|^WL/.test(art)) return 'Sandals';
  if (/^WF|^WC|^WE|^WES/.test(art)) return 'Casual Slippers';
  if (/^FLR/.test(art)) return 'Sandals';

  if (gender === 'Men') return 'Casual Slippers';
  if (gender === 'Women') return 'Sandals';
  return 'Casual Slippers';
}

function extractCategoryFromTokens(tokens: string[]): string | null {
  for (let i = 0; i < tokens.length; i++) {
    const combined = `${tokens[i]}_${tokens[i + 1] ?? ''}`.toLowerCase().replace(/-/g, '_');
    if (CATEGORY_ALIASES[combined]) return CATEGORY_ALIASES[combined];
    const single = tokens[i].toLowerCase().replace(/-/g, '_');
    if (CATEGORY_ALIASES[single]) return CATEGORY_ALIASES[single];
  }
  return null;
}

function normalizeCategoryToken(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const key = raw.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  return CATEGORY_ALIASES[key] ?? sanitizeImportCategory(raw);
}

function defaultSizesForGender(gender: CatalogImportMetadata['gender']): number[] {
  switch (gender) {
    case 'Women': return [4, 5, 6, 7, 8];
    case 'Kids': return [1, 2, 3, 4, 5, 6, 7, 8];
    case 'Men': return [6, 7, 8, 9, 10];
    default: return [5, 6, 7, 8, 9, 10];
  }
}

function extractPriceFromTokens(tokens: string[]): number | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const raw = tokens[i].replace(/[,₹rs]/gi, '');
    const m = raw.match(/^(\d{2,4})(?:\.(\d{1,2}))?$/);
    if (m) {
      const value = parseInt(m[1], 10);
      if (value >= 99 && value <= 9999) return value;
    }
  }
  return null;
}

function extractArtNumber(tokens: string[]): string {
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (/^[A-Z]{1,3}\d{2,5}[A-Z]?$/.test(upper)) return upper;
    if (/^\d{3,6}$/.test(token) && token.length <= 6) return token;
  }
  return '';
}

function extractColor(tokens: string[]): string {
  const joined = tokens.join(' ').toLowerCase();
  for (const known of KNOWN_COLORS) {
    if (joined.includes(known)) {
      return known.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (KNOWN_COLORS.includes(lower)) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
  }
  return 'Standard';
}

function extractGender(tokens: string[]): CatalogImportMetadata['gender'] {
  const joined = tokens.join(' ').toLowerCase();
  if (/\b(women|woman|ladies|lady|girls|girl|wmns|wmn)\b/.test(joined)) return 'Women';
  if (/\b(kids|kid|child|children|boys|girls|junior)\b/.test(joined)) return 'Kids';
  if (/\b(men|man|boys|gents|male|mns)\b/.test(joined)) return 'Men';
  if (/\b(unisex|uni)\b/.test(joined)) return 'Unisex';
  return 'Unisex';
}

function detectBrandFromTokens(tokens: string[]): string {
  const joined = tokens.join(' ');
  for (const known of KNOWN_FOOTWEAR_BRANDS) {
    if (joined.toLowerCase().includes(known.toLowerCase())) return known;
  }
  if (tokens.length > 0 && !/^\d+$/.test(tokens[0]) && !/^[A-Z]\d+$/i.test(tokens[0])) {
    const candidate = tokens[0];
    if (candidate.length >= 2 && candidate.length <= 20) return candidate;
  }
  return GENERIC_BRAND_NAME;
}

/**
 * Build product metadata from filename + optional folder name (no AI / API key).
 * Examples:
 *   Walkaroo_Women_Flip_Flops_W187_Blue_189.jpg
 *   Walkaroo_W187_Blue_189.jpg  (gender/category inferred from art number)
 *   Paragon Flex Men 399.png
 */
export function parseCatalogFilename(
  fileName: string,
  folderHint?: string
): CatalogImportMetadata {
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
  const normalized = baseName
    .replace(/[₹]/g, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized.split(' ').filter(Boolean);
  const folderTokens = folderHint
    ? folderHint.replace(/[_\-.]+/g, ' ').split(' ').filter(Boolean)
    : [];

  let brand = detectBrandFromTokens([...folderTokens, ...tokens]);
  if (brand === GENERIC_BRAND_NAME && folderHint) {
    const fromFolder = splitCombinedBrandString(folderHint.trim());
    if (fromFolder.brand) brand = normalizeImportBrandName(fromFolder.brand);
  }

  const model = extractArtNumber(tokens) || tokens.find(t => /^[A-Za-z]+\d+$/i.test(t)) || '';
  const color = extractColor(tokens);
  const explicitCategory = extractCategoryFromTokens([...folderTokens, ...tokens]);
  const price = extractPriceFromTokens(tokens) ?? DEFAULT_CATALOG_PRICE;

  const genderFromTokens = extractGender([...folderTokens, ...tokens]);
  const hasExplicitGender = /\b(men|women|kids|unisex)\b/i.test(normalized);
  const gender = hasExplicitGender
    ? genderFromTokens
    : inferGenderFromArtNumber(model);

  const category = explicitCategory
    ?? inferCategoryFromCatalog(model, undefined, gender);

  const normalizedMeta = normalizeBrandAndModel(brand, model, buildImportProductName(brand, model, baseName));
  const name = normalizedMeta.name;
  const finalBrand = normalizedMeta.brand;
  const finalModel = normalizedMeta.model;

  const brandFromFilename = brand !== GENERIC_BRAND_NAME;
  const modelFromFilename = !!finalModel;

  return {
    brand: finalBrand,
    model: finalModel,
    name,
    gender,
    category: normalizeCategoryToken(category, 'Casual Slippers'),
    material: DEFAULT_CATALOG_MATERIAL,
    mrp: price,
    offer_price: price,
    description: `${name} — ${gender} ${category} available at VijayaSri Footwear.`,
    features: [
      'Comfortable everyday wear',
      'Durable sole construction',
      'Available in multiple sizes',
    ],
    tags: [finalBrand, gender, category, color].filter(t => t && t !== GENERIC_BRAND_NAME),
    collections: finalBrand !== GENERIC_BRAND_NAME ? [finalBrand, gender] : [gender],
    color,
    sizes: defaultSizesForGender(gender),
    aiConfidence: brandFromFilename && modelFromFilename ? 75 : brandFromFilename ? 55 : 35,
    aiAnalysisDetails: {
      brandStatus: brandFromFilename ? 'exact' : 'absent',
      modelStatus: modelFromFilename ? 'certain' : 'absent',
      categoryStatus: explicitCategory ? 'certain' : 'uncertain',
      materialStatus: 'uncertain',
    },
  };
}
