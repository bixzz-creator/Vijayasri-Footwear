import {
  computePremiumPricing,
  DEFAULT_PRESENTATION_SETTINGS,
  loadPresentationSettings,
  type PresentationSettings,
  type PremiumPricingResult,
} from './presentation';

export type StorefrontGender = 'Men' | 'Women' | 'Kids' | 'Unisex';

export interface StorefrontCategoryGroup {
  id: string;
  label: string;
  icon: string;
  matches: string[];
}

/** Shop-by-type chips — maps to importer/AI category names in the database. */
export const STOREFRONT_CATEGORY_GROUPS: StorefrontCategoryGroup[] = [
  { id: 'slippers', label: 'Slippers', icon: '🩴', matches: ['Casual Slippers', 'Bathroom Slippers', 'Slippers'] },
  { id: 'sandals', label: 'Sandals', icon: '👡', matches: ['Sandals'] },
  { id: 'flip-flops', label: 'Flip-Flops', icon: '🩴', matches: ['Flip-Flops', 'Flip Flops'] },
  { id: 'slides', label: 'Slides', icon: '⛸️', matches: ['Slides', 'Sports Slides'] },
  { id: 'sports', label: 'Sports Shoes', icon: '👟', matches: ['Sports Shoes', 'Sneakers', 'Running Shoes'] },
  { id: 'formal', label: 'Formal Shoes', icon: '👞', matches: ['Formal Shoes'] },
  { id: 'casual', label: 'Casual Shoes', icon: '👢', matches: ['Casual Shoes'] },
  { id: 'crocs', label: 'Crocs', icon: '🟢', matches: ['Crocs', 'Kids Footwear'] },
];

/** Full category list for admin product create/edit and bulk import review. */
export const ADMIN_FOOTWEAR_CATEGORIES = [
  'Casual Slippers',
  'Bathroom Slippers',
  'Sandals',
  'Flip-Flops',
  'Slides',
  'Sports Slides',
  'Formal Shoes',
  'Casual Shoes',
  'Sports Shoes',
  'Sneakers',
  'Running Shoes',
  'Crocs',
  'Kids Footwear',
  'Slippers',
] as const;

export type AdminFootwearCategory = (typeof ADMIN_FOOTWEAR_CATEGORIES)[number];

/** Quick shop chips above the product grid (Slippers vs Shoes). */
export const STOREFRONT_CATEGORY_FAMILIES = [
  { id: 'all', label: 'All Footwear' },
  { id: 'slippers-open', label: 'Slippers & Open', groupIds: ['slippers', 'flip-flops', 'sandals', 'slides'] },
  { id: 'shoes', label: 'Shoes', groupIds: ['formal', 'casual', 'sports'] },
  { id: 'crocs', label: 'Crocs & Kids', groupIds: ['crocs'] },
] as const;

export function categoryMatchesFamily(productCategory: string, familyId: string): boolean {
  if (!familyId || familyId === 'all') return true;
  const family = STOREFRONT_CATEGORY_FAMILIES.find(f => f.id === familyId);
  if (!family || !('groupIds' in family)) return true;
  return family.groupIds.some(gid => categoryMatchesFilter(productCategory, gid));
}

/** Map OCR/DB category strings to admin dropdown values. */
export function coerceAdminCategory(value: string, fallback: AdminFootwearCategory = 'Casual Slippers'): string {
  const normalized = normalizeCategoryLabel(value);
  if (!normalized) return fallback;
  const exact = ADMIN_FOOTWEAR_CATEGORIES.find(c => categoryKey(c) === categoryKey(normalized));
  if (exact) return exact;
  for (const group of STOREFRONT_CATEGORY_GROUPS) {
    if (group.matches.some(m => categoryKey(m) === categoryKey(normalized))) {
      const mapped = ADMIN_FOOTWEAR_CATEGORIES.find(c => categoryKey(c) === categoryKey(group.matches[0]));
      if (mapped) return mapped;
    }
  }
  return normalized;
}

function categoryKey(value: string): string {
  return value.toLowerCase().replace(/[-_\s]/g, '');
}

export function normalizeCategoryLabel(category: string): string {
  return category.trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

export function categoryMatchesFilter(productCategory: string, filterValue: string): boolean {
  if (!filterValue || filterValue === 'All') return true;

  const group = STOREFRONT_CATEGORY_GROUPS.find(
    g => g.id === filterValue || g.label === filterValue || categoryKey(g.label) === categoryKey(filterValue)
  );
  if (group) {
    const productKey = categoryKey(productCategory);
    return group.matches.some(m => {
      const mk = categoryKey(m);
      return productKey === mk || productKey.includes(mk) || mk.includes(productKey);
    });
  }

  return categoryKey(productCategory) === categoryKey(filterValue);
}

export function genderMatchesFilter(productGender: string, filterGender: string): boolean {
  if (!filterGender || filterGender === 'All') return true;
  if (filterGender === 'Unisex') return productGender === 'Unisex';
  return productGender === filterGender || productGender === 'Unisex';
}

/** Resolve semantic search hints to a category filter group id. */
export function semanticCategoryFromQuery(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('offer') || q.includes('discount') || q.includes('sale')) return '';
  if (q.includes('office') || q.includes('formal') || q.includes('leather')) return 'formal';
  if (/\b(shoe|shoes|footwear|loafer|boot|derby|oxford)\b/.test(q)) return 'formal';
  if (q.includes('flip') || q.includes('hawaii') || q.includes('thong')) return 'flip-flops';
  if (q.includes('bath') || q.includes('bathroom')) return 'slippers';
  if (q.includes('soft') || q.includes('daily') || q.includes('comfort') || q.includes('slipper')) return 'slippers';
  if (q.includes('crocs') || q.includes('clog')) return 'crocs';
  if (q.includes('sport') || q.includes('running') || q.includes('gym') || q.includes('sneaker')) return 'sports';
  if (q.includes('sandal') || q.includes('strap') || q.includes('floater')) return 'sandals';
  if (q.includes('slide')) return 'slides';
  if (q.includes('casual') || q.includes('loafer')) return 'casual';
  if (q.includes('women') || q.includes('ladies')) return '';
  if (q.includes('men') || q.includes('gents')) return '';
  if (q.includes('kids') || q.includes('child')) return '';
  return '';
}

export function semanticGenderFromQuery(query: string): StorefrontGender | '' {
  const q = query.toLowerCase();
  if (/\b(women|woman|ladies|lady|girls)\b/.test(q)) return 'Women';
  if (/\b(men|man|gents|gentlemen|boys)\b/.test(q)) return 'Men';
  if (/\b(kids|kid|children|child|junior)\b/.test(q)) return 'Kids';
  if (/\bunisex\b/.test(q)) return 'Unisex';
  return '';
}

export function getStorefrontPricing(
  product: { mrp: number; offer_price: number },
  settings?: PresentationSettings
): PremiumPricingResult {
  const cfg = settings ?? loadPresentationSettings();
  const sellingPrice = Math.max(0, Math.round(product.offer_price));

  if (!cfg.enableDiscountGenerator) {
    const displayMrp = Math.max(sellingPrice, Math.round(product.mrp || sellingPrice));
    return {
      sellingPrice,
      displayMrp,
      discountPercent: 0,
      amountSaved: 0,
      showDiscount: false,
    };
  }

  const dbHasDiscount = product.mrp > sellingPrice;
  const tiered = computePremiumPricing(sellingPrice);
  const displayMrp = dbHasDiscount
    ? Math.round(product.mrp)
    : cfg.enableSmartPricing
      ? tiered.displayMrp
      : sellingPrice;

  const showDiscount = displayMrp > sellingPrice;
  const amountSaved = showDiscount ? displayMrp - sellingPrice : 0;
  const discountPercent = showDiscount
    ? Math.round((amountSaved / displayMrp) * 100)
    : 0;

  return { sellingPrice, displayMrp, discountPercent, amountSaved, showDiscount };
}

export function productHasStorefrontOffer(
  product: { mrp: number; offer_price: number },
  settings?: PresentationSettings
): boolean {
  return getStorefrontPricing(product, settings).showDiscount;
}

export function loadStorefrontPresentationSettings(): PresentationSettings {
  try {
    return loadPresentationSettings();
  } catch {
    return { ...DEFAULT_PRESENTATION_SETTINGS };
  }
}

export const GENDER_FILTER_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: 'All', label: 'All', icon: '👣' },
  { value: 'Men', label: 'Men', icon: '👨' },
  { value: 'Women', label: 'Women', icon: '👩' },
  { value: 'Kids', label: 'Kids', icon: '🧒' },
  { value: 'Unisex', label: 'Unisex', icon: '👥' },
];

/** Common footwear color names → swatch hex for filter chips. */
export const COLOR_SWATCH_MAP: Record<string, string> = {
  black: '#111827',
  white: '#f9fafb',
  blue: '#2563eb',
  navy: '#1e3a8a',
  red: '#dc2626',
  maroon: '#7f1d1d',
  brown: '#78350f',
  beige: '#d6d3c4',
  'french beige': '#c8b89a',
  grey: '#6b7280',
  gray: '#6b7280',
  green: '#059669',
  yellow: '#eab308',
  orange: '#ea580c',
  pink: '#ec4899',
  purple: '#9333ea',
  gold: '#ca8a04',
  cream: '#fef3c7',
  tan: '#d2b48c',
  wine: '#722f37',
  mustard: '#ca8a04',
  peach: '#fdba74',
  turquoise: '#14b8a6',
  olive: '#65a30d',
  silver: '#9ca3af',
  copper: '#b45309',
  bronze: '#92400e',
  lavender: '#a78bfa',
  coral: '#fb7185',
  mint: '#6ee7b7',
  khaki: '#bdb76b',
  coffee: '#6f4e37',
  chocolate: '#3e2723',
  burgundy: '#800020',
  teal: '#0d9488',
  sand: '#c2b280',
  camel: '#c19a6b',
  ivory: '#fffff0',
  standard: '#e5e7eb',
};

const COLOR_PRIORITY = [
  'Black', 'White', 'Blue', 'Maroon', 'Brown', 'Red', 'Grey', 'Green',
  'Beige', 'French Beige', 'Navy', 'Pink', 'Purple', 'Yellow', 'Orange',
];

export function normalizeColorLabel(color: string): string {
  return color
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function getColorSwatchHex(color: string): string {
  const key = color.toLowerCase().replace(/_/g, ' ').trim();
  if (COLOR_SWATCH_MAP[key]) return COLOR_SWATCH_MAP[key];
  for (const [name, hex] of Object.entries(COLOR_SWATCH_MAP)) {
    if (key.includes(name) || name.includes(key)) return hex;
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

export function extractProductColors(products: Array<{ variants?: Array<{ color?: string }> }>): string[] {
  const set = new Set<string>();
  for (const p of products) {
    for (const v of p.variants ?? []) {
      if (v.color?.trim()) set.add(normalizeColorLabel(v.color));
    }
  }
  const list = Array.from(set);
  list.sort((a, b) => {
    const ai = COLOR_PRIORITY.findIndex(c => c.toLowerCase() === a.toLowerCase());
    const bi = COLOR_PRIORITY.findIndex(c => c.toLowerCase() === b.toLowerCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  return list;
}

export function productMatchesColor(
  product: { variants?: Array<{ color?: string }> },
  selectedColor: string
): boolean {
  if (!selectedColor || selectedColor === 'All') return true;
  const target = selectedColor.toLowerCase().replace(/_/g, ' ').trim();
  return product.variants?.some(v => {
    const c = (v.color ?? '').toLowerCase().replace(/_/g, ' ').trim();
    return c === target || c.includes(target) || target.includes(c);
  }) ?? false;
}
