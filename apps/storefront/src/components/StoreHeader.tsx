import React, { useState, useRef, useEffect } from 'react';
import { Search, Heart, MessageCircle, Phone, ChevronDown } from 'lucide-react';
import { STOREFRONT_CATEGORY_GROUPS } from '@vijayasri/shared';
import { storeTelUrl, storeWhatsAppUrl } from '../config/contact';


export type NavKey = 'new' | 'men' | 'women' | 'kids' | 'sale';

interface StoreHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: () => void;
  activeNav: NavKey | null;
  favoritesCount: number;
  showFavoritesOnly: boolean;
  onNavSelect: (nav: NavKey) => void;
  onCategorySelect: (categoryId: string) => void;
  onResetHome: () => void;
  onToggleFavorites: () => void;
  placeholderText?: string;
}

const MEGA_MENUS: Record<NavKey, { title: string; columns: { heading: string; links: { label: string; action: 'category' | 'nav'; value: string }[] }[] }> = {
  new: {
    title: 'New & Featured',
    columns: [
      {
        heading: 'Featured',
        links: [
          { label: 'New Arrivals', action: 'nav', value: 'new' },
          { label: 'Best Sellers', action: 'nav', value: 'new' },
          { label: 'Shop All Offers', action: 'nav', value: 'sale' },
        ],
      },
      {
        heading: 'Shop All',
        links: [
          { label: "All Men's Footwear", action: 'nav', value: 'men' },
          { label: "All Women's Footwear", action: 'nav', value: 'women' },
          { label: "Kids' Footwear", action: 'nav', value: 'kids' },
        ],
      },
    ],
  },
  men: {
    title: "Men's Footwear",
    columns: [
      {
        heading: 'Featured',
        links: [
          { label: 'New Arrivals', action: 'nav', value: 'new' },
          { label: 'Offers & Deals', action: 'nav', value: 'sale' },
        ],
      },
      {
        heading: 'Shop by Type',
        links: STOREFRONT_CATEGORY_GROUPS.map(g => ({
          label: g.label,
          action: 'category' as const,
          value: g.id,
        })),
      },
    ],
  },
  women: {
    title: "Women's Footwear",
    columns: [
      {
        heading: 'Featured',
        links: [
          { label: 'New Arrivals', action: 'nav', value: 'new' },
          { label: 'Offers & Deals', action: 'nav', value: 'sale' },
        ],
      },
      {
        heading: 'Shop by Type',
        links: STOREFRONT_CATEGORY_GROUPS.map(g => ({
          label: g.label,
          action: 'category' as const,
          value: g.id,
        })),
      },
    ],
  },
  kids: {
    title: "Kids' Footwear",
    columns: [
      {
        heading: 'Featured',
        links: [
          { label: 'New Arrivals', action: 'nav', value: 'new' },
          { label: 'Crocs & Clogs', action: 'category', value: 'crocs' },
        ],
      },
      {
        heading: 'Shop by Type',
        links: STOREFRONT_CATEGORY_GROUPS.filter(g => ['slippers', 'sandals', 'flip-flops', 'crocs', 'sports'].includes(g.id)).map(g => ({
          label: g.label,
          action: 'category' as const,
          value: g.id,
        })),
      },
    ],
  },
  sale: {
    title: 'Sale & Offers',
    columns: [
      {
        heading: 'Deals',
        links: [
          { label: 'All Offers', action: 'nav', value: 'sale' },
          { label: 'Slippers on Offer', action: 'category', value: 'slippers' },
          { label: 'Sandals on Offer', action: 'category', value: 'sandals' },
        ],
      },
      {
        heading: 'Browse',
        links: [
          { label: "Men's Sale", action: 'nav', value: 'men' },
          { label: "Women's Sale", action: 'nav', value: 'women' },
        ],
      },
    ],
  },
};

const NAV_ITEMS: { key: NavKey; label: string }[] = [
  { key: 'new', label: 'New & Featured' },
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'kids', label: 'Kids' },
  { key: 'sale', label: 'Sale' },
];

export function StoreHeader({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  activeNav,
  favoritesCount,
  showFavoritesOnly,
  onNavSelect,
  onCategorySelect,
  onResetHome,
  onToggleFavorites,
  placeholderText = 'Search "Walkaroo WGR50042", brand, color…',
}: StoreHeaderProps) {
  const [openMega, setOpenMega] = useState<NavKey | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMega(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleMegaLink = (action: 'category' | 'nav', value: string, parentNav: NavKey) => {
    if (action === 'nav') {
      onNavSelect(value as NavKey);
    } else {
      onNavSelect(parentNav);
      onCategorySelect(value);
    }
    setOpenMega(null);
    document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit?.();
    }
    if (e.key === 'Escape') {
      onSearchChange('');
      searchInputRef.current?.blur();
    }
  };

  return (
    <header ref={headerRef} className={`nike-header${scrolled ? ' scrolled' : ''}`}>
      <div className="nike-header-top">
        <div className="container nike-header-top-inner">
          <span>Browse online — enquire via call or WhatsApp only</span>
          <div className="nike-header-top-links">
            <a href={storeTelUrl()}>Call us</a>
            <a href={storeWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
        </div>
      </div>

      <div className="nike-header-main">
        <div className="container nike-header-main-inner">
          <button type="button" className="nike-logo" onClick={onResetHome} aria-label="VijayaSri Footwear home">
            <img src="/logo.png" alt="VijayaSri Footwear Logo" className="nike-logo-img" />
            <span className="nike-logo-mark">
              <strong>VijayaSri Footwear</strong>
            </span>
          </button>

          <nav className="nike-nav desktop-only" aria-label="Main">
            {NAV_ITEMS.map(item => (
              <div
                key={item.key}
                className="nike-nav-item"
                onMouseEnter={() => setOpenMega(item.key)}
              >
                <button
                  type="button"
                  className={`nike-nav-link ${activeNav === item.key ? 'active' : ''}`}
                  onClick={() => {
                    onNavSelect(item.key);
                    setOpenMega(item.key);
                    document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </nav>

          <form
            className={`nike-header-search ${isSearchFocused ? 'is-focused' : ''}`}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit?.();
              setIsSearchFocused(false);
            }}
          >
            <button
              type="submit"
              className="nike-header-search-btn"
              aria-label="Submit search"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'inherit' }}
            >
              <Search size={18} aria-hidden />
            </button>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 220)}
              placeholder={placeholderText}
              className="nike-header-search-input"
              aria-label="Search products"
              enterKeyHint="search"
            />
            {searchQuery && (
              <button
                type="button"
                className="nike-header-search-clear"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}

            {/* Quick Suggestions Dropdown on Focus */}
            {isSearchFocused && !searchQuery && (
              <div className="search-quick-suggestions animate-fade-in">
                <span className="quick-suggestions-title">TRY SEARCHING FOR:</span>
                <div className="quick-suggestions-chips">
                  {[
                    'under 500',
                    'Walkaroo WGR50042',
                    'Paragon',
                    'Black slippers',
                    "Women's sandals",
                    'Formal shoes',
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      className="quick-chip"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSearchChange(chip);
                        setIsSearchFocused(false);
                      }}
                    >
                      <Search size={12} />
                      <span>{chip}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>

          <div className="nike-header-actions">
            <button
              type="button"
              className={`nike-icon-btn ${showFavoritesOnly ? 'active' : ''}`}
              onClick={onToggleFavorites}
              aria-label="Favorites"
            >
              <Heart size={20} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
              {favoritesCount > 0 && <span className="nike-badge">{favoritesCount}</span>}
            </button>

            <a href={storeWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="nike-icon-btn nike-wa-btn" aria-label="WhatsApp">
              <MessageCircle size={20} />
            </a>

            <a href={storeTelUrl()} className="nike-icon-btn desktop-only" aria-label="Call store">
              <Phone size={20} />
            </a>
          </div>
        </div>
      </div>

      {openMega && (
        <div
          className="nike-mega-menu"
          onMouseLeave={() => setOpenMega(null)}
        >
          <div className="container nike-mega-inner">
            {MEGA_MENUS[openMega].columns.map(col => (
              <div key={col.heading} className="nike-mega-col">
                <h4>{col.heading}</h4>
                <ul>
                  {col.links.map(link => (
                    <li key={link.label}>
                      <button
                        type="button"
                        onClick={() => handleMegaLink(link.action, link.value, openMega)}
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="nike-mobile-nav mobile-only">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            type="button"
            className={activeNav === item.key ? 'active' : ''}
            onClick={() => {
              onNavSelect(item.key);
              document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {item.label}
            <ChevronDown size={12} />
          </button>
        ))}
      </div>
    </header>
  );
}
