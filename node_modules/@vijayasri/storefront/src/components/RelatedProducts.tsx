import React from 'react';
import { ProductCard, type StorefrontProduct } from './ProductCard';
import type { PresentationSettings } from '@vijayasri/shared';

interface RelatedProductsProps {
  currentProduct: StorefrontProduct;
  allProducts: StorefrontProduct[];
  favorites: string[];
  presentationSettings?: PresentationSettings;
  onOpen: (product: StorefrontProduct) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onWhatsApp: (product: StorefrontProduct, e: React.MouseEvent) => void;
}

export function RelatedProducts({
  currentProduct,
  allProducts,
  favorites,
  presentationSettings,
  onOpen,
  onToggleFavorite,
  onWhatsApp,
}: RelatedProductsProps) {
  const currentGender = currentProduct.gender;

  const candidates = allProducts.filter(p => {
    if (p.id === currentProduct.id || p.status !== 'published') return false;

    // Gender matching: Men's footwear suggests Men's or Unisex footwear only
    if (currentGender && currentGender !== 'Unisex' && p.gender && p.gender !== 'Unisex') {
      if (p.gender !== currentGender) return false;
    }

    return true;
  });

  // Score candidates by similarity
  const scored = candidates.map(p => {
    let score = 0;
    if (p.category && p.category === currentProduct.category) score += 4;
    if (p.gender && p.gender === currentProduct.gender) score += 3;
    if (p.brandName && p.brandName === currentProduct.brandName) score += 2;
    return { product: p, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const related = scored.map(s => s.product).slice(0, 4);

  if (related.length === 0) return null;

  return (
    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
      <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
        You May Also Like
      </h4>
      <div className="vsf-related-grid">
        {related.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            variant="nike"
            presentationSettings={presentationSettings}
            isFavorite={favorites.includes(product.id)}
            onToggleFavorite={(e) => onToggleFavorite(product.id, e)}
            onOpen={() => onOpen(product)}
            onQuickView={(e) => { e.stopPropagation(); onOpen(product); }}
            onWhatsApp={(e) => onWhatsApp(product, e)}
          />
        ))}
      </div>
    </div>
  );
}
