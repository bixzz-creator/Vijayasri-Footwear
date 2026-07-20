import React from 'react';
import { ProductCard, type StorefrontProduct } from './ProductCard';
import type { PresentationSettings } from '@vijayasri/shared';

interface RecentlyViewedProps {
  productIds: string[];
  allProducts: StorefrontProduct[];
  favorites: string[];
  presentationSettings?: PresentationSettings;
  onOpen: (product: StorefrontProduct) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onWhatsApp: (product: StorefrontProduct, e: React.MouseEvent) => void;
}

export function RecentlyViewed({
  productIds,
  allProducts,
  favorites,
  presentationSettings,
  onOpen,
  onToggleFavorite,
  onWhatsApp,
}: RecentlyViewedProps) {
  const items = productIds
    .map(id => allProducts.find(p => p.id === id))
    .filter((p): p is StorefrontProduct => Boolean(p));

  if (items.length === 0) return null;

  return (
    <section className="container vsf-recent-section">
      <h3 className="vsf-section-title">Recently Viewed</h3>
      <div className="vsf-horizontal-scroll">
        {items.map(product => (
          <div key={product.id} className="vsf-horizontal-card">
            <ProductCard
              product={product}
              variant="nike"
              presentationSettings={presentationSettings}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={(e) => onToggleFavorite(product.id, e)}
              onOpen={() => onOpen(product)}
              onQuickView={(e) => { e.stopPropagation(); onOpen(product); }}
              onWhatsApp={(e) => onWhatsApp(product, e)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
