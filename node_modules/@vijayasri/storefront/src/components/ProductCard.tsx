import React, { useState } from 'react';
import {
  formatCurrency,
  getStorefrontPricing,
  normalizeCategoryLabel,
  productHasStorefrontOffer,
  type PresentationSettings,
} from '@vijayasri/shared';
import { Heart } from 'lucide-react';

export interface StorefrontProduct {
  id: string;
  name: string;
  brandName?: string;
  gender?: string;
  category?: string;
  mrp: number;
  offer_price: number;
  status?: string;
  created_at?: string;
  variants?: Array<{
    color?: string;
    images?: Array<{ url: string; is_primary?: boolean; sort_order?: number }>;
    sizes?: Array<{ stock: number }>;
  }>;
  ai_analysis_details?: {
    presentation?: { seoImageAlt?: string };
  };
}

interface ProductCardProps {
  product: StorefrontProduct;
  isFavorite: boolean;
  presentationSettings?: PresentationSettings;
  variant?: 'default' | 'nike';
  index?: number;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onQuickView: (e: React.MouseEvent) => void;
  onWhatsApp: (e: React.MouseEvent) => void;
}

function getProductImage(product: StorefrontProduct): string | null {
  const variant = product.variants?.[0];
  if (!variant?.images?.length) return null;
  const sorted = [...variant.images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const primary = sorted.find(i => i.is_primary) || sorted[0];
  return primary?.url || null;
}

function getProductLabel(product: StorefrontProduct, presentationSettings?: PresentationSettings): string | null {
  if (productHasStorefrontOffer(product, presentationSettings)) return 'Offer';
  if (product.created_at) {
    const age = Date.now() - new Date(product.created_at).getTime();
    if (age < 30 * 24 * 60 * 60 * 1000) return 'Just In';
  }
  return null;
}

function getSubtitle(product: StorefrontProduct): string {
  const parts = [
    product.brandName,
    product.gender ? `${product.gender}'s` : '',
    product.category ? normalizeCategoryLabel(product.category) : 'Footwear',
  ].filter(Boolean);
  return parts.join(' · ') || 'Footwear';
}

export function ProductCard({
  product,
  isFavorite,
  presentationSettings,
  variant = 'nike',
  onToggleFavorite,
  onOpen,
  onQuickView,
  onWhatsApp,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const imageUrl = getProductImage(product);
  const pricing = getStorefrontPricing(product, presentationSettings);
  const { displayMrp, sellingPrice, showDiscount } = pricing;
  const label = getProductLabel(product, presentationSettings);
  const alt =
    product.ai_analysis_details?.presentation?.seoImageAlt ||
    `${product.brandName || ''} ${product.name}`.trim();

  // Discount percentage
  const discountPct = showDiscount && displayMrp > sellingPrice
    ? Math.round((1 - sellingPrice / displayMrp) * 100)
    : 0;

  // Color swatches from all variants
  const variantColors = product.variants
    ?.map(v => v.color)
    .filter((c): c is string => !!c && c !== 'Standard')
    .slice(0, 5) ?? [];

  // Low stock detection
  const totalStock = product.variants
    ?.flatMap(v => v.sizes ?? [])
    .reduce((sum, s) => sum + (s.stock ?? 0), 0) ?? null;
  const isLowStock = totalStock !== null && totalStock > 0 && totalStock <= 5;

  if (variant === 'nike') {
    return (
      <article
        className="nike-product-card"
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="nike-product-image-wrap">
          {/* Badges */}
          {(label || isLowStock) && (
            <div className="nike-product-badge">
              {label && (
                <span className={`badge-pill ${label === 'Offer' ? 'offer' : 'new'}`}>
                  {label === 'Offer' ? `${discountPct > 0 ? `${discountPct}% Off` : 'Offer'}` : label}
                </span>
              )}
              {isLowStock && (
                <span className="badge-pill low-stock">Only {totalStock} left</span>
              )}
            </div>
          )}
          <button
            type="button"
            className="nike-product-wishlist"
            aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}
            onClick={onToggleFavorite}
          >
            <Heart
              size={18}
              strokeWidth={2}
              fill={isFavorite ? '#DC2626' : 'none'}
              color={isFavorite ? '#DC2626' : undefined}
            />
          </button>
          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={alt}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`product-img-progressive ${imgLoaded ? 'loaded' : 'loading'} ${hovered ? 'hovered' : ''}`}
            />
          ) : (
            <div className="nike-product-no-image brand-fallback">
              <img src="/logo.png" alt="VijayaSri Footwear" className="fallback-logo-img" />
              <span>VijayaSri Footwear</span>
            </div>
          )}
        </div>
        <div className="nike-product-info">
          <span className="nike-product-label">{product.brandName || 'Footwear'}</span>
          <h4 className="nike-product-name">{product.name}</h4>
          <p className="nike-product-subtitle">{getSubtitle(product)}</p>
          <div className="nike-product-price-row">
            <span className="nike-product-price">{formatCurrency(sellingPrice)}</span>
            {showDiscount && (
              <span className="nike-product-mrp">{formatCurrency(displayMrp)}</span>
            )}
            {discountPct > 0 && (
              <span className="nike-product-discount">{discountPct}% off</span>
            )}
          </div>
          {variantColors.length > 0 && (
            <div className="nike-product-swatches">
              {variantColors.map(color => (
                <span
                  key={color}
                  className="swatch-dot"
                  title={color}
                  style={{ background: color.toLowerCase() }}
                />
              ))}
            </div>
          )}
          <div className={`nike-product-actions ${hovered ? 'visible' : ''}`}>
            <button type="button" onClick={onQuickView}>Quick View</button>
            <button type="button" onClick={onWhatsApp}>WhatsApp</button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="nike-product-card" onClick={onOpen}>
      <div className="nike-product-image-wrap">
        <button type="button" className="nike-product-wishlist" onClick={onToggleFavorite}>
          <Heart size={22} fill={isFavorite ? '#DC2626' : 'none'} />
        </button>
        {imageUrl ? <img src={imageUrl} alt={alt} loading="lazy" /> : <div className="nike-product-no-image">No Image</div>}
      </div>
      <div className="nike-product-info">
        <h4 className="nike-product-name">{product.name}</h4>
        <span className="nike-product-price">{formatCurrency(sellingPrice)}</span>
      </div>
    </article>
  );
}

export { getProductImage };
