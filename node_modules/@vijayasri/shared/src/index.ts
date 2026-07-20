export * from './types';
export * from './presentation';
export * from './storefront-catalog';

/**
 * Automatically generates a standardized SKU for product cataloging.
 * Format: VSF-{GENDER}-{CATEGORY_ABBR}-{BRAND_ABBR}-{SEQUENCE}
 */
export function generateSku(
  gender: string,
  category: string,
  brand: string,
  sequenceNumber: number
): string {
  const genMap: Record<string, string> = {
    'Men': 'MEN',
    'Women': 'WMN',
    'Kids': 'KID',
    'Unisex': 'UNS'
  };
  const gen = genMap[gender] || gender.slice(0, 3).toUpperCase();
  const cat = category.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'SLD';
  const brd = brand.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'VSF';
  const seq = String(sequenceNumber).padStart(4, '0');
  
  return `VSF-${gen}-${cat}-${brd}-${seq}`;
}

/**
 * Format numeric value as Indian Rupee (INR).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}
