import React from 'react';
import { Phone, MessageCircle, MapPin, Star, ShoppingBag, ArrowRight, Sparkles, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCarousel } from './ProductCarousel';
import type { StorefrontProduct } from './ProductCard';
import type { PresentationSettings } from '@vijayasri/shared';
import { storeTelUrl, storeWhatsAppUrl } from '../config/contact';

interface HomeShowcaseProps {
  newArrivals: StorefrontProduct[];
  bestPicks: StorefrontProduct[];
  presentationSettings?: PresentationSettings;
  favorites: string[];
  onToggleFavorite: (productId: string, e: React.MouseEvent) => void;
  onOpenProduct: (product: StorefrontProduct) => void;
  onWhatsApp: (product: StorefrontProduct, e: React.MouseEvent) => void;
  onBrowseNew: () => void;
  onBrowseOffers: () => void;
  onNavigate?: (section: 'home' | 'men' | 'women' | 'offers' | 'faq') => void;
  onCategoryChip?: (categoryId: string) => void;
}

const CATEGORY_CHIPS = [
  { icon: '🩴', label: 'Slippers',     categoryId: 'slippers' },
  { icon: '👡', label: 'Sandals',      categoryId: 'sandals' },
  { icon: '👟', label: 'Sports',       categoryId: 'sports' },
  { icon: '👞', label: 'Formal',       categoryId: 'formal' },
  { icon: '🟢', label: 'Crocs',        categoryId: 'crocs' },
  { icon: '🎉', label: 'Offers',       categoryId: 'offers' },
];

function getProductImageUrl(p: StorefrontProduct): string | null {
  const images = p.variants?.[0]?.images;
  if (!images || images.length === 0) return null;
  const primary = images.find(img => img.is_primary) || images[0];
  return primary?.url || null;
}

export function HomeShowcase({
  newArrivals,
  bestPicks,
  presentationSettings,
  favorites,
  onToggleFavorite,
  onOpenProduct,
  onWhatsApp,
  onBrowseNew,
  onBrowseOffers,
  onNavigate,
  onCategoryChip,
}: HomeShowcaseProps) {
  // Catalog Spotlight auto-swiping state from actual published products
  const spotlightProducts = React.useMemo(() => {
    const combined = [...newArrivals, ...bestPicks];
    const valid = combined.filter(p => !!getProductImageUrl(p));
    return valid.length > 0 ? valid : combined;
  }, [newArrivals, bestPicks]);

  const [spotlightIndex, setSpotlightIndex] = React.useState(0);
  const [isFading, setIsFading] = React.useState(false);

  React.useEffect(() => {
    if (spotlightProducts.length <= 1) return;
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setSpotlightIndex(prev => (prev + 1) % spotlightProducts.length);
        setIsFading(false);
      }, 250);
    }, 3800);
    return () => clearInterval(timer);
  }, [spotlightProducts.length]);

  const handlePrevSpotlight = () => {
    if (spotlightProducts.length <= 1) return;
    setIsFading(true);
    setTimeout(() => {
      setSpotlightIndex(prev => (prev - 1 + spotlightProducts.length) % spotlightProducts.length);
      setIsFading(false);
    }, 150);
  };

  const handleNextSpotlight = () => {
    if (spotlightProducts.length <= 1) return;
    setIsFading(true);
    setTimeout(() => {
      setSpotlightIndex(prev => (prev + 1) % spotlightProducts.length);
      setIsFading(false);
    }, 150);
  };

  const currentSpotlight = spotlightProducts[spotlightIndex % spotlightProducts.length];
  const spotlightImgUrl = currentSpotlight ? getProductImageUrl(currentSpotlight) : null;
  const currentDiscountPct = currentSpotlight && currentSpotlight.mrp && currentSpotlight.mrp > currentSpotlight.offer_price
    ? Math.round((1 - currentSpotlight.offer_price / currentSpotlight.mrp) * 100)
    : 0;

  return (
    <div className="home-showcase">
      {/* ── Hero Section (Modern Red & Black Flagship Dual-Column Showcase) ──── */}
      <section className="home-hero">
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-radial-glow" aria-hidden="true" />
        <div className="container home-hero-grid animate-fade-in">
          
          {/* Left Column: Hero Content */}
          <div className="home-hero-content">

            <h1 className="home-hero-title">
              STEP INTO <span className="text-highlight-red">EXCELLENCE</span>
              <br />
              <span className="brand-subname">VIJAYASRI FOOTWEAR</span>
            </h1>

            <p className="home-hero-text">
              Browse 300+ authentic slippers, sandals, formal &amp; sports shoes from <strong>Walkaroo, Paragon, VKC</strong> &amp; top brands. Try before you buy at our Ayyempettai store or enquire directly on WhatsApp.
            </p>

            <div className="home-hero-ctas">
              <button
                type="button"
                className="btn home-hero-btn primary"
                onClick={onBrowseNew}
              >
                <ShoppingBag size={18} />
                <span>Shop New Arrivals</span>
              </button>
              <button
                type="button"
                className="btn home-hero-btn secondary"
                onClick={onBrowseOffers}
              >
                <span>Explore Offers</span>
                <ArrowRight size={16} />
              </button>
              <a
                href={storeWhatsAppUrl('Hi VijayaSri Footwear! I want to enquire about products.')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn home-hero-btn whatsapp"
              >
                <MessageCircle size={18} />
                <span>WhatsApp Enquiry</span>
              </a>
            </div>

            {/* Quick Hero Metrics */}
            <div className="home-hero-stats">
              <div className="stat-pill">
                <strong>300+</strong>
                <span>Styles in Store</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-pill">
                <strong>100%</strong>
                <span>Genuine Brands</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-pill">
                <strong>4.8 ★</strong>
                <span>Customer Rating</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Coverflow Loop Carousel */}
          <div className="home-hero-spotlight">
            {spotlightProducts.length > 0 ? (
              <div className="coverflow-root">
                {/* Prev Arrow */}
                <button
                  type="button"
                  className="coverflow-arrow left"
                  aria-label="Previous"
                  onClick={(e) => { e.stopPropagation(); handlePrevSpotlight(); }}
                >
                  <ChevronLeft size={20} />
                </button>

                {/* 3D Track */}
                <div className="coverflow-track">
                  {[-2, -1, 0, 1, 2].map(offset => {
                    const total = spotlightProducts.length;
                    const idx = ((spotlightIndex + offset) % total + total) % total;
                    const product = spotlightProducts[idx];
                    const imgUrl = getProductImageUrl(product);
                    const discPct = product.mrp && product.mrp > product.offer_price
                      ? Math.round((1 - product.offer_price / product.mrp) * 100) : 0;
                    const absOffset = Math.abs(offset);

                    // 3D position math
                    const rotateY  = offset * 38;           // deg
                    const translateX = offset * 58;         // %
                    const translateZ = absOffset === 0 ? 80 : absOffset === 1 ? 0 : -100; // px
                    const scale    = absOffset === 0 ? 1 : absOffset === 1 ? 0.82 : 0.64;
                    const opacity  = absOffset === 0 ? 1 : absOffset === 1 ? 0.72 : 0.38;
                    const zIndex   = 10 - absOffset * 3;

                    return (
                      <div
                        key={`${idx}-${offset}`}
                        className={`coverflow-card ${offset === 0 ? 'active' : ''}`}
                        style={{
                          transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                          opacity,
                          zIndex,
                          cursor: offset === 0 ? 'pointer' : 'pointer',
                        }}
                        onClick={() => {
                          if (offset === 0) {
                            onOpenProduct(product);
                          } else {
                            setSpotlightIndex(idx);
                          }
                        }}
                      >
                        {/* Discount Badge */}
                        {discPct > 0 && (
                          <div className="coverflow-badge">
                            <Sparkles size={11} />
                            <span>{discPct}% OFF</span>
                          </div>
                        )}

                        {/* Image */}
                        <div className="coverflow-img-wrap">
                          <img
                            src={imgUrl || '/hero_red_black.png'}
                            alt={product.name}
                            className="coverflow-img"
                            draggable={false}
                          />
                        </div>

                        {/* Info — only on center card */}
                        {offset === 0 && (
                          <div className="coverflow-info">
                            <div className="coverflow-title-row">
                              <h4 className="coverflow-name">{product.name}</h4>
                              <div className="coverflow-price-box">
                                <span className="coverflow-price">₹{product.offer_price}</span>
                                {product.mrp && product.mrp > product.offer_price && (
                                  <span className="coverflow-mrp">₹{product.mrp}</span>
                                )}
                              </div>
                            </div>
                            <p className="coverflow-sub">
                              {product.brandName || 'VijayaSri'} · {product.gender ? `${product.gender}'s` : ''} {product.category}
                            </p>
                            <div className="coverflow-footer">
                              <span className="store-availability-tag">
                                <CheckCircle2 size={12} /> Try in store &amp; buy
                              </span>
                              <span className="coverflow-view-btn">View Details →</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Next Arrow */}
                <button
                  type="button"
                  className="coverflow-arrow right"
                  aria-label="Next"
                  onClick={(e) => { e.stopPropagation(); handleNextSpotlight(); }}
                >
                  <ChevronRight size={20} />
                </button>

                {/* Dots */}
                <div className="coverflow-dots">
                  {spotlightProducts.slice(0, Math.min(8, spotlightProducts.length)).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`coverflow-dot ${i === spotlightIndex % Math.min(8, spotlightProducts.length) ? 'active' : ''}`}
                      onClick={() => setSpotlightIndex(i)}
                      aria-label={`Go to product ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </section>

      {/* ── Category quick-links ──────────────────────────────── */}
      <div className="home-category-band">
        <div className="container home-category-band-inner">
          {CATEGORY_CHIPS.map(chip => (
            <button
              key={chip.categoryId}
              type="button"
              className="home-category-chip-btn"
              onClick={() => {
                if (chip.categoryId === 'offers') {
                  onNavigate?.('offers');
                } else {
                  onCategoryChip?.(chip.categoryId);
                }
              }}
            >
              <span className="cat-icon">{chip.icon}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trust bar ────────────────────────────────────────── */}
      <div className="container vsf-trust-bar">
        <div className="vsf-trust-grid">
          <a href={storeTelUrl()} className="vsf-trust-item">
            <span className="vsf-trust-icon"><Phone size={18} /></span>
            <div>
              <strong>Call to enquire</strong>
              <span>+91 83000 29513 · Mon–Sat 10am–8pm</span>
            </div>
          </a>
          <a
            href={storeWhatsAppUrl('Hi VijayaSri! I want to enquire about a product.')}
            target="_blank"
            rel="noopener noreferrer"
            className="vsf-trust-item"
          >
            <span className="vsf-trust-icon"><MessageCircle size={18} /></span>
            <div>
              <strong>WhatsApp us</strong>
              <span>Quick product enquiry, size check</span>
            </div>
          </a>
          <a
            href="https://www.google.com/maps/place/VIJAYA+SRI+FOOTWEARS/@10.8955943,79.18823,17z/data=!3m1!4b1!4m6!3m5!1s0x3baac5f2003cb19b:0x49a3c69e00f6e82a!8m2!3d10.8955943!4d79.18823!16s%2Fg%2F11ddxl1ydm"
            target="_blank"
            rel="noopener noreferrer"
            className="vsf-trust-item"
          >
            <span className="vsf-trust-icon"><MapPin size={18} /></span>
            <div>
              <strong>Visit showroom</strong>
              <span>Ayyempettai, Thanjavur · Try before you buy</span>
            </div>
          </a>
          <div className="vsf-trust-item">
            <span className="vsf-trust-icon"><Star size={18} /></span>
            <div>
              <strong>300+ products</strong>
              <span>Walkaroo, Paragon, VKC &amp; more top brands</span>
            </div>
          </div>
        </div>
      </div>



      {/* ── Product carousels ─────────────────────────────────── */}
      <div className="container home-carousels">
        <ProductCarousel
          title="New Arrivals"
          subtitle="Fresh uploads from our latest catalog"
          products={newArrivals}
          presentationSettings={presentationSettings}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpenProduct}
          onWhatsApp={onWhatsApp}
          onViewAll={onBrowseNew}
        />

        <ProductCarousel
          title="Best Picks"
          subtitle="Top styles across slippers, shoes &amp; sandals"
          products={bestPicks}
          presentationSettings={presentationSettings}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpenProduct}
          onWhatsApp={onWhatsApp}
          onViewAll={() =>
            document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' })
          }
        />
      </div>
    </div>
  );
}
