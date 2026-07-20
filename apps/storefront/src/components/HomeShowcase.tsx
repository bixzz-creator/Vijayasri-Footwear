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
  // Dynamic Fisher-Yates Shuffling for fresh user experience
  const shuffledNewArrivals = React.useMemo(() => {
    if (!newArrivals || newArrivals.length === 0) return [];
    const arr = [...newArrivals];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [newArrivals]);

  const shuffledBestPicks = React.useMemo(() => {
    if (!bestPicks || bestPicks.length === 0) return [];
    const arr = [...bestPicks];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [bestPicks]);

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

                    return (
                      <div
                        key={`${idx}-${offset}`}
                        className={`coverflow-item ${offset === 0 ? 'center' : ''}`}
                        onClick={() => onOpenProduct(product)}
                      >
                        {imgUrl ? (
                          <img src={imgUrl} alt={product.name} className="coverflow-img" loading="lazy" />
                        ) : (
                          <div className="coverflow-fallback">VijayaSri</div>
                        )}
                        {discPct > 0 && <span className="coverflow-badge">{discPct}% OFF</span>}
                        <div className="coverflow-info">
                          <span className="brand">{product.brandName || 'VijayaSri'}</span>
                          <h4 className="title">{product.name}</h4>
                          <span className="price">₹{product.offer_price}</span>
                        </div>
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

      {/* ── Product carousels (Dynamically randomized for fresh user recommendations) ─── */}
      <div className="container home-carousels">
        <ProductCarousel
          title="New Arrivals"
          subtitle="Fresh uploads & recommended picks from our catalog"
          products={shuffledNewArrivals}
          presentationSettings={presentationSettings}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onOpen={onOpenProduct}
          onWhatsApp={onWhatsApp}
          onViewAll={onBrowseNew}
        />

        <ProductCarousel
          title="Best Picks & Trending"
          subtitle="Popular footwear across Walkaroo, Paragon & VKC"
          products={shuffledBestPicks}
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

      {/* ── About VijayaSri Footwear & Top Brands Section (Moved to Bottom) ───────── */}
      <div className="container vsf-about-brands-section" style={{ margin: '3rem auto 1.5rem auto', padding: '2rem 1.5rem', background: '#09090b', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 1.75rem auto' }}>
          <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
            15+ Years Serving Ayyempettai &amp; Thanjavur
          </span>
          <h2 style={{ fontSize: '1.6rem', color: '#FFFFFF', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '0.75rem' }}>
            About VijayaSri Footwear
          </h2>
          <p style={{ color: '#A1A1AA', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Established in Main Road, Ayyempettai, VijayaSri Footwear is your premier family footwear showroom. We bring you 100% genuine slippers, sandals, formal shoes, and sports footwear from India’s leading trusted brands. Try before you buy at our showroom or order directly via WhatsApp!
          </p>
        </div>

        {/* Leading Brands Grid Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          {['Walkaroo', 'Paragon', 'VKC Pride', 'Sparx', 'Campus', 'Bata', 'Liberty', 'Action', 'Relaxo'].map(brand => (
            <div key={brand} style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <CheckCircle2 size={14} color="#DC2626" />
              {brand}
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick Info Trust Bar (Moved to the Very Bottom) ────────────────── */}
      <div className="container vsf-trust-bar" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
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
    </div>
  );
}
