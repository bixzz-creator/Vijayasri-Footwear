import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard, type StorefrontProduct } from './ProductCard';
import type { PresentationSettings } from '@vijayasri/shared';

interface ProductCarouselProps {
  title: string;
  subtitle?: string;
  products: StorefrontProduct[];
  presentationSettings?: PresentationSettings;
  favorites: string[];
  onToggleFavorite: (productId: string, e: React.MouseEvent) => void;
  onOpen: (product: StorefrontProduct) => void;
  onWhatsApp: (product: StorefrontProduct, e: React.MouseEvent) => void;
  onViewAll?: () => void;
}

export function ProductCarousel({
  title,
  subtitle,
  products,
  presentationSettings,
  favorites,
  onToggleFavorite,
  onOpen,
  onWhatsApp,
  onViewAll,
}: ProductCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(280, track.clientWidth * 0.85);
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <section className="product-carousel" aria-label={title}>
      <div className="product-carousel-head">
        <div>
          <h3 className="product-carousel-title">{title}</h3>
          {subtitle && <p className="product-carousel-subtitle">{subtitle}</p>}
        </div>
        <div className="product-carousel-actions">
          {onViewAll && (
            <button type="button" className="product-carousel-view-all" onClick={onViewAll}>
              View all
            </button>
          )}
          <button type="button" className="product-carousel-arrow" onClick={() => scrollBy(-1)} aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className="product-carousel-arrow" onClick={() => scrollBy(1)} aria-label="Next">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="product-carousel-track" ref={trackRef}>
        {products.map((product, idx) => (
          <div className="product-carousel-slide" key={product.id}>
            <ProductCard
              product={product}
              index={idx}
              variant="nike"
              presentationSettings={presentationSettings}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={(e) => onToggleFavorite(product.id, e)}
              onOpen={() => onOpen(product)}
              onQuickView={(e) => {
                e.stopPropagation();
                onOpen(product);
              }}
              onWhatsApp={(e) => onWhatsApp(product, e)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
