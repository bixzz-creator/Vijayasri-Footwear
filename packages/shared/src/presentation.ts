/** Admin-configurable presentation pipeline toggles. */
export interface PresentationSettings {
  enableImageEnhancement: boolean;
  enableBackgroundReplacement: boolean;
  enableSmartPricing: boolean;
  enableDiscountGenerator: boolean;
  allowOriginalImageToggle: boolean;
}

export const DEFAULT_PRESENTATION_SETTINGS: PresentationSettings = {
  enableImageEnhancement: false,
  enableBackgroundReplacement: false,
  enableSmartPricing: true,
  enableDiscountGenerator: true,
  allowOriginalImageToggle: false,
};

export type BackgroundTheme =
  | 'pure-white'
  | 'warm-ivory'
  | 'light-stone'
  | 'soft-gradient'
  | 'glass-card'
  | 'warm-gray'
  | 'soft-gray'
  | 'stone-white'
  | 'blush'
  | 'ice-blue'
  | 'mint-white';

export interface PremiumPricingResult {
  sellingPrice: number;
  displayMrp: number;
  discountPercent: number;
  amountSaved: number;
  showDiscount: boolean;
}

/** OCR / printed price tiers → premium display MRP. */
const DISPLAY_MRP_TIERS: [number, number][] = [
  [199, 249],
  [299, 399],
  [399, 499],
  [599, 799],
  [829, 999],
  [999, 1199],
  [1299, 1499],
];

/**
 * OCR price is the selling price. Generate a premium display MRP for strikethrough.
 */
export function computePremiumPricing(ocrPrice: number): PremiumPricingResult {
  const sellingPrice = Math.max(0, Math.round(ocrPrice));
  let displayMrp = sellingPrice;

  for (const [sell, display] of DISPLAY_MRP_TIERS) {
    if (sellingPrice >= sell - 25) {
      displayMrp = display;
    }
  }

  if (sellingPrice > 1499) {
    displayMrp = Math.ceil(sellingPrice * 1.15 / 100) * 100 - 1;
  }

  displayMrp = Math.max(displayMrp, sellingPrice);
  const showDiscount = displayMrp > sellingPrice;
  const amountSaved = showDiscount ? displayMrp - sellingPrice : 0;
  const discountPercent = showDiscount
    ? Math.round((amountSaved / displayMrp) * 100)
    : 0;

  return { sellingPrice, displayMrp, discountPercent, amountSaved, showDiscount };
}

export function generateSeoImageAlt(
  name: string,
  brand: string,
  color: string
): string {
  const parts = [brand, name, color].filter(Boolean);
  return `${parts.join(' ')} — premium footwear at VijayaSri Footwear, Coimbatore`;
}

const PRESENTATION_STORAGE_KEY = 'vijayasri_presentation_settings';

export function loadPresentationSettings(): PresentationSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PRESENTATION_SETTINGS };
  try {
    const raw = localStorage.getItem(PRESENTATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRESENTATION_SETTINGS };
    return { ...DEFAULT_PRESENTATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRESENTATION_SETTINGS };
  }
}

export function savePresentationSettings(settings: PresentationSettings): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PRESENTATION_STORAGE_KEY, JSON.stringify(settings));
}
