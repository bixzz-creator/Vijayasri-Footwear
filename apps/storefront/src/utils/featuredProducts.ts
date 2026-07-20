import { productHasStorefrontOffer, type PresentationSettings } from '@vijayasri/shared';
import { getProductImage, type StorefrontProduct } from '../components/ProductCard';

function isPublishedWithImage(p: StorefrontProduct): boolean {
  return p.status !== 'draft' && Boolean(getProductImage(p));
}

function byNewest(a: StorefrontProduct, b: StorefrontProduct): number {
  return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
}

/** Latest uploads with product photos — for the home slider. */
export function pickNewArrivals(products: StorefrontProduct[], limit = 14): StorefrontProduct[] {
  return [...products]
    .filter(isPublishedWithImage)
    .sort(byNewest)
    .slice(0, limit);
}

/** Curated mix: offers, fresh stock, high confidence — diverse categories (not slippers-only). */
export function pickBestPicks(
  products: StorefrontProduct[],
  presentationSettings?: PresentationSettings,
  limit = 14
): StorefrontProduct[] {
  const pool = products.filter(isPublishedWithImage);
  const ranked = pool
    .map(p => {
      let score = 0;
      if (productHasStorefrontOffer(p, presentationSettings)) score += 4;
      if (p.created_at) {
        const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
        if (ageDays < 7) score += 3;
        else if (ageDays < 21) score += 2;
        else if (ageDays < 45) score += 1;
      }
      if (((p as StorefrontProduct & { ai_confidence_score?: number }).ai_confidence_score ?? 0) >= 85) {
        score += 1;
      }
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score || byNewest(a.product, b.product));

  const picked: StorefrontProduct[] = [];
  const seenCategories = new Set<string>();

  for (const { product } of ranked) {
    if (picked.length >= limit) break;
    const catKey = (product.category || 'other').toLowerCase();
    if (picked.length < 8 && seenCategories.has(catKey) && seenCategories.size >= 3) {
      continue;
    }
    if (picked.some(x => x.id === product.id)) continue;
    picked.push(product);
    seenCategories.add(catKey);
  }

  return picked;
}
