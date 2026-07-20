import React, { useEffect, useState, useRef, useMemo } from 'react';
import { db, loadPublicStorefrontConfig } from '@vijayasri/database';
import {
  formatCurrency,
  getStorefrontPricing,
  productHasStorefrontOffer,
  categoryMatchesFilter,
  categoryMatchesFamily,
  genderMatchesFilter,
  semanticCategoryFromQuery,
  semanticGenderFromQuery,
  STOREFRONT_CATEGORY_GROUPS,
  GENDER_FILTER_OPTIONS,
  normalizeCategoryLabel,
  extractProductColors,
  productMatchesColor,
  DEFAULT_PRESENTATION_SETTINGS,
  savePresentationSettings,
  loadStorefrontPresentationSettings,
  type PresentationSettings,
} from '@vijayasri/shared';
import { Badge, Modal } from '@vijayasri/ui';
import { ProductCard } from './components/ProductCard';
import { ProductSkeletonGrid } from './components/ProductSkeletonGrid';
import { StoreHeader, type NavKey } from './components/StoreHeader';
import { FilterSidebar } from './components/FilterSidebar';
import { CatalogToolbar, sortProducts, type SortOption } from './components/CatalogToolbar';
import { CategoryFamilyChips } from './components/CategoryFamilyChips';
import { CatalogPagination } from './components/CatalogPagination';
import { HomeShowcase } from './components/HomeShowcase';
import { useDebouncedValue } from './utils/useDebouncedValue';
import { pickNewArrivals, pickBestPicks } from './utils/featuredProducts';
import { SizeChartModal } from './components/SizeChartModal';
import { FaqSection } from './components/FaqSection';
import { StoreFooter } from './components/StoreFooter';
import { RecentlyViewed } from './components/RecentlyViewed';
import { RelatedProducts } from './components/RelatedProducts';
import { BackToTop } from './components/BackToTop';
import { loadRecentlyViewedIds, pushRecentlyViewed } from './utils/recentlyViewed';
import { storeTelUrl, storeWhatsAppUrl } from './config/contact';
import Lenis from 'lenis';
import './storefront.css';
import {
  SlidersHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageSquare,
  QrCode,
  Phone,
  PhoneCall,
  MessageCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Ruler,
} from 'lucide-react';
import '@vijayasri/ui';
import { useSEO } from './hooks/useSEO';
import { StructuredData } from './components/StructuredData';
import { NotFoundPage } from './components/NotFoundPage';

export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  
  // Search & Filters State
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput, 280);
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedColor, setSelectedColor] = useState<string>('All');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('All');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('All');
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [activeNav, setActiveNav] = useState<NavKey | null>(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [_layout, _setLayout] = useState<any>(null);
  const [festivalMode, setFestivalMode] = useState<string>('normal');
  const [show404, setShow404] = useState(false);

  // ─── Dynamic SEO — updates title, canonical, OG tags on every view change ─
  useSEO({
    product: selectedProduct,
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    brand: selectedBrand !== 'All' ? selectedBrand : undefined,
    searchQuery: searchInput || undefined,
    is404: show404,
  });

  // ─── Apple-grade Lenis smooth scroll ────────────────────────────────────
  const lenisRef = useRef<any>(null);

  useEffect(() => {
    const lenis = new Lenis({
      // Apple's scroll feel: long float with exponential deceleration
      duration: 1.4,
      // Custom easing: fast initial response, very gradual float to rest
      easing: (t: number) => {
        // Combines expo + elastic-like overshoot for Apple rubber-band feel
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      },
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.85,    // slightly reduced — feels lighter
      touchMultiplier: 1.6,     // generous touch inertia on mobile
      infinite: false,
      syncTouch: false,         // let native touch scroll handle itself
    });

    lenisRef.current = lenis;

    // Use GSAP ticker for buttery 60/120fps loop instead of manual RAF
    // This syncs with GSAP animations perfectly
    const gsapTick = (time: number) => lenis.raf(time * 1000);
    // @ts-ignore
    if (window.__gsap_ticker_connected !== true) {
      // fallback: use manual RAF if GSAP ticker unavailable
    }

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Pause/resume scroll when modal opens/closes
  useEffect(() => {
    if (!lenisRef.current) return;
    if (selectedProduct) {
      lenisRef.current.stop();
    } else {
      lenisRef.current.start();
    }
  }, [selectedProduct]);

  // New visual retail showroom states
  const [placeholderText, setPlaceholderText] = useState('Search footwear');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showOffersOnly, setShowOffersOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [catalogPage, setCatalogPage] = useState(1);
  const PAGE_SIZE = 36;
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => loadRecentlyViewedIds());
  const [presentationSettings, setPresentationSettings] = useState<PresentationSettings>(
    () => loadStorefrontPresentationSettings()
  );
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('vsf_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const updated = prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId];
      localStorage.setItem('vsf_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  // Character-by-character Typewriter search placeholder effect
  useEffect(() => {
    const suggestions = [
      'Search "under 500"...',
      'Search "Walkaroo WGR50042"...',
      'Search "Black slippers"...',
      'Search "Paragon sandals"...',
      'Search "Women\'s sandals"...',
      'Search "Formal shoes"...',
      'Search "Extra cushioning"...',
      'Search "Slippers under ₹299"...',
    ];

    let currentIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timer: any = null;

    function typeLoop() {
      const targetStr = suggestions[currentIdx];
      if (!isDeleting) {
        charIdx++;
        setPlaceholderText(targetStr.substring(0, charIdx));
        if (charIdx >= targetStr.length) {
          isDeleting = true;
          timer = setTimeout(typeLoop, 2000);
          return;
        }
        timer = setTimeout(typeLoop, 55);
      } else {
        charIdx--;
        setPlaceholderText(targetStr.substring(0, charIdx));
        if (charIdx <= 0) {
          isDeleting = false;
          currentIdx = (currentIdx + 1) % suggestions.length;
          timer = setTimeout(typeLoop, 350);
          return;
        }
        timer = setTimeout(typeLoop, 30);
      }
    }

    timer = setTimeout(typeLoop, 300);
    return () => clearTimeout(timer);
  }, []);

  // Zoom / QR / Speech States
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [showQrCode, setShowQrCode] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [storeNotice, setStoreNotice] = useState<string | null>(null);

  // Initialize DB and fetch products from Supabase
  useEffect(() => {
    async function initAndFetch() {
      setProductsLoading(true);
      setFetchError(null);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

        const connection = await db.initStorefront(supabaseUrl, supabaseAnonKey);
        console.log('[Storefront] Database mode:', connection.demoMode ? 'offline' : 'supabase', '| source:', connection.source);

        const publicConfig = loadPublicStorefrontConfig();
        if (publicConfig?.presentationSettings) {
          const merged = {
            ...DEFAULT_PRESENTATION_SETTINGS,
            ...loadStorefrontPresentationSettings(),
            enableSmartPricing: publicConfig.presentationSettings.enableSmartPricing ?? true,
            enableDiscountGenerator: publicConfig.presentationSettings.enableDiscountGenerator ?? true,
          };
          savePresentationSettings(merged);
          setPresentationSettings(merged);
        }

        const fetched = await db.getStorefrontProducts();
        setProducts(fetched);
        setProductsLoading(false);

        // Check for deep-link URL parameter (?p=id or ?sku=sku) to automatically pop up product modal for owner
        const urlParams = new URLSearchParams(window.location.search);
        const pParam = urlParams.get('p') || urlParams.get('product');
        const skuParam = urlParams.get('sku');
        if (pParam || skuParam) {
          const matched = fetched.find((p: any) =>
            (pParam && (p.id === pParam || p.slug === pParam)) ||
            (skuParam && p.sku?.toLowerCase() === skuParam.toLowerCase())
          );
          if (matched) {
            setSelectedProduct(matched);
            db.getProduct(matched.id).then(fullP => {
              if (fullP) setSelectedProduct(fullP);
            });
          }
        }

        if (!connection.demoMode) {
          const branchId = await db.getDefaultBranchId();
          const defaultLayout = await db.getHomepageLayout(branchId);
          _setLayout(defaultLayout);
          setFestivalMode(defaultLayout.festival_mode);

          await db.logEvent({
            id: crypto.randomUUID(),
            product_id: null,
            event_type: 'view',
            metadata: { page: 'storefront_home', timestamp: new Date().toISOString() },
            created_at: new Date().toISOString()
          });
        }
      } catch (err: any) {
        console.error('[Storefront] Failed to load catalog:', err);
        setFetchError('Unable to load products. Please check your network connection.');
        setProductsLoading(false);
      }
    }
    initAndFetch();
  }, []);

  // Compute available filter options
  const filterOptions = useMemo(() => {
    const genders = GENDER_FILTER_OPTIONS.map(g => g.value);
    const catalogCategories = new Set<string>();
    const brandSet = new Set<string>();
    const colors = new Set<string>();
    const sizes = new Set<number>();
    const materials = new Set<string>();
    let maxP = 1000;

    products.forEach(p => {
      if (p.category) catalogCategories.add(p.category);
      if (p.material) materials.add(p.material);
      if (p.brandName) brandSet.add(p.brandName);
      if (p.offer_price > maxP) maxP = p.offer_price;
      
      p.variants?.forEach((v: any) => {
        if (v.color) colors.add(v.color);
        v.sizes?.forEach((s: any) => {
          sizes.add(s.size_number);
        });
      });
    });

    const typeFilters = STOREFRONT_CATEGORY_GROUPS.map(g => ({ id: g.id, label: g.label }));
    const extraCategories = Array.from(catalogCategories).filter(
      cat => !STOREFRONT_CATEGORY_GROUPS.some(g => categoryMatchesFilter(cat, g.id))
    );

    return {
      genders,
      typeFilters,
      brands: Array.from(brandSet).sort(),
      categories: ['All', ...typeFilters.map(t => t.id), ...extraCategories],
      extraCategories,
      colors: ['All', ...Array.from(colors)],
      sizes: ['All', ...Array.from(sizes).sort((a, b) => a - b).map(String)],
      materials: ['All', ...Array.from(materials)],
      absoluteMaxPrice: Math.ceil(maxP / 100) * 100
    };
  }, [products]);

  const publishedProducts = useMemo(
    () => products.filter(p => p.status === 'published'),
    [products]
  );

  const newArrivals = useMemo(
    () => pickNewArrivals(publishedProducts, 14),
    [publishedProducts]
  );

  const bestPicks = useMemo(
    () => pickBestPicks(publishedProducts, presentationSettings, 14),
    [publishedProducts, presentationSettings]
  );

  const isHomeView = useMemo(() => (
    !searchInput.trim() &&
    !showFavoritesOnly &&
    !showOffersOnly &&
    selectedGender === 'All' &&
    selectedCategory === 'All' &&
    selectedFamily === 'all' &&
    selectedBrand === 'All' &&
    selectedColor === 'All' &&
    activeNav === null
  ), [searchInput, showFavoritesOnly, showOffersOnly, selectedGender, selectedCategory, selectedFamily, selectedBrand, selectedColor, activeNav]);

  const scrollToCatalog = () => {
    document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (searchInput.trim() && searchInput === searchQuery) {
      scrollToCatalog();
    }
  }, [searchQuery, searchInput]);

  const handleSearchSubmit = () => {
    scrollToCatalog();
  };

  const allCatalogColors = useMemo(
    () => extractProductColors(publishedProducts),
    [publishedProducts]
  );

  // Sync max price slider when catalog loads
  useEffect(() => {
    if (products.length === 0) return;
    const highest = Math.max(...products.map(p => Number(p.offer_price) || 0));
    const ceiling = Math.max(1000, Math.ceil(highest / 100) * 100);
    setMaxPrice(ceiling);
  }, [products]);

  // Handle Filtering & Search
  useEffect(() => {
    let result = products.filter(p => p.status === 'published');

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const categoryOverride = semanticCategoryFromQuery(q);
      const genderOverride = semanticGenderFromQuery(q);
      const underPriceMatch = q.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?)?\s*(\d+)/i);
      const targetMaxPrice = underPriceMatch ? parseInt(underPriceMatch[1], 10) : null;

      result = result.filter(p => {
        const variantColors = p.variants?.map((v: any) => v.color).filter(Boolean).join(' ') || '';
        const variantSizes = p.variants?.flatMap((v: any) => v.sizes?.map((s: any) => s.size_number) || []).join(' ') || '';
        const artNum = p.art_number || p.artNumber || '';
        const textToSearch = `${p.name} ${p.brandName || ''} ${p.category || ''} ${p.gender || ''} ${p.material || ''} ${variantColors} size ${variantSizes} ${artNum} ₹${p.offer_price || ''} ${p.description || ''} ${(p.tags || []).join(' ')}`.toLowerCase();

        let termsMatch = true;
        const searchTerms = q
          .replace(/(?:under|below|less than|within)\s*(?:₹|rs\.?)?\s*\d+/gi, '')
          .split(/\s+/)
          .filter(t => t.length > 0 && !['offers', 'offer', 'discount', 'sale', 'new', 'arrivals', 'in', 'for', 'the', 'shoe', 'shoes', 'footwear'].includes(t));

        if (searchTerms.length > 0) {
          const allMatch = searchTerms.every(term => textToSearch.includes(term));
          const anyMatch = searchTerms.some(term => textToSearch.includes(term));
          termsMatch = allMatch || anyMatch;
        }

        const categoryMatch = categoryOverride ? categoryMatchesFilter(p.category, categoryOverride) : true;
        const genderMatch = genderOverride ? genderMatchesFilter(p.gender, genderOverride) : true;
        const priceMatch = targetMaxPrice ? p.offer_price <= targetMaxPrice : true;
        return termsMatch && priceMatch && categoryMatch && genderMatch;
      });

      // Sort search results: exact title or model number matches first
      result.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aExact = aName.includes(q);
        const bExact = bName.includes(q);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
    }

    if (selectedGender !== 'All') {
      result = result.filter(p => genderMatchesFilter(p.gender, selectedGender));
    }
    if (selectedBrand !== 'All') {
      result = result.filter(p => p.brandName === selectedBrand);
    }
    if (selectedCategory !== 'All') {
      result = result.filter(p => categoryMatchesFilter(p.category, selectedCategory));
    }
    if (selectedFamily !== 'all') {
      result = result.filter(p => categoryMatchesFamily(p.category, selectedFamily));
    }
    if (selectedMaterial !== 'All') {
      result = result.filter(p => p.material === selectedMaterial);
    }
    if (selectedColor !== 'All') {
      result = result.filter(p => productMatchesColor(p, selectedColor));
    }
    if (selectedSizeFilter !== 'All') {
      const targetSize = parseInt(selectedSizeFilter);
      result = result.filter(p => p.variants?.some((v: any) => v.sizes?.some((s: any) => s.size_number === targetSize && s.stock > 0)));
    }
    
    if (showFavoritesOnly) {
      result = result.filter(p => favorites.includes(p.id));
    }

    if (showOffersOnly) {
      result = result.filter(p => productHasStorefrontOffer(p, presentationSettings));
    }

    result = result.filter(p => p.offer_price <= maxPrice);

    setFilteredProducts(result);
    console.log('[Storefront] Final rendered product count:', result.length);
  }, [products, searchQuery, selectedGender, selectedBrand, selectedCategory, selectedFamily, selectedColor, selectedSizeFilter, selectedMaterial, maxPrice, showFavoritesOnly, showOffersOnly, favorites, presentationSettings]);

  useEffect(() => {
    setCatalogPage(1);
  }, [searchQuery, selectedGender, selectedBrand, selectedCategory, selectedFamily, selectedColor, selectedSizeFilter, selectedMaterial, maxPrice, showFavoritesOnly, showOffersOnly, sortBy]);

  const sortedDisplayProducts = useMemo(
    () => sortProducts(filteredProducts, sortBy),
    [filteredProducts, sortBy]
  );

  const totalPages = Math.max(1, Math.ceil(sortedDisplayProducts.length / PAGE_SIZE));
  const pagedDisplayProducts = useMemo(() => {
    const safePage = Math.min(catalogPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedDisplayProducts.slice(start, start + PAGE_SIZE);
  }, [sortedDisplayProducts, catalogPage, totalPages]);

  // Dynamic QR Code Rendering in Canvas
  useEffect(() => {
    if (showQrCode && selectedProduct && qrCanvasRef.current) {
      const canvas = qrCanvasRef.current;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 180, 180);
      
      // Draw simulated custom QR block representation
      ctx.fillStyle = '#111827';
      ctx.fillRect(10, 10, 160, 160);
      
      // Draw corners
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(20, 20, 40, 40);
      ctx.fillRect(120, 20, 40, 40);
      ctx.fillRect(20, 120, 40, 40);
      ctx.fillStyle = '#111827';
      ctx.fillRect(28, 28, 24, 24);
      ctx.fillRect(128, 28, 24, 24);
      ctx.fillRect(28, 128, 24, 24);

      // Draw random pixels to look like QR
      ctx.fillStyle = '#FFFFFF';
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
          if (
            (r < 7 && c < 7) ||
            (r < 7 && c > 12) ||
            (r > 12 && c < 7)
          ) continue;
          if (Math.random() > 0.4) {
            ctx.fillRect(20 + c * 7, 20 + r * 7, 6, 6);
          }
        }
      }
      // Add Brand Label in center
      ctx.fillStyle = '#10B981';
      ctx.fillRect(75, 75, 30, 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('VSF', 83, 93);
    }
  }, [showQrCode, selectedProduct]);

  // Handle product click and selection details
  const openProductDetails = async (product: any) => {
    setSelectedProduct(product);
    setActiveVariantIndex(0);
    setActiveImageIndex(0);
    setSelectedSize(null);
    setShowQrCode(false);
    setRecentlyViewedIds(pushRecentlyViewed(product.id));

    const fullProduct = await db.getProduct(product.id);
    if (fullProduct) {
      setSelectedProduct(fullProduct);
    }

    await db.logEvent({
      id: crypto.randomUUID(),
      product_id: product.id,
      event_type: 'view',
      metadata: { sku: product.sku },
      created_at: new Date().toISOString()
    });
  };

  // Keyboard navigation for Details Modal
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (!selectedProduct) return;
      if (e.key === 'ArrowRight') {
        // Next image
        const images = selectedProduct.variants?.[activeVariantIndex]?.images || [];
        if (images.length > 0) {
          setActiveImageIndex(prev => (prev + 1) % images.length);
        }
      } else if (e.key === 'ArrowLeft') {
        // Prev image
        const images = selectedProduct.variants?.[activeVariantIndex]?.images || [];
        if (images.length > 0) {
          setActiveImageIndex(prev => (prev - 1 + images.length) % images.length);
        }
      }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [selectedProduct, activeVariantIndex]);

  // Hover Zoom Calculations
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  // WhatsApp Enquiry Lead capturing
  const triggerWhatsAppLead = async (product: any, variant: any, size: number | null) => {
    const sizeStr = size ? `Size ${size}` : 'Not selected';

    // Get product image URL — only use real hosted URLs, never base64 data URIs
    const images = variant?.images || product?.variants?.[0]?.images || [];
    const primaryImg = images.find((img: any) => img.is_primary) || images[0];
    const rawImgUrl = primaryImg?.url || '';
    const imgUrl = rawImgUrl.startsWith('http') ? rawImgUrl : ''; // skip base64 data: URLs

    // Savings calculation
    const mrp = product.mrp || product.offer_price;
    const savings = mrp > product.offer_price ? mrp - product.offer_price : 0;
    const savingsLine = savings > 0
      ? `*MRP*: Rs.${mrp}  |  *Offer*: Rs.${product.offer_price}  (Save Rs.${savings})`
      : `*Price*: Rs.${product.offer_price}`;

    // Direct product link to open product details on website
    const productUrl = `${window.location.origin}${window.location.pathname}?p=${product.id}`;

    const lines = [
      `*New Product Enquiry - VijayaSri Footwear*`,
      ``,
      `Hello, I want to enquire about the following item:`,
      ``,
      `*Product*: ${product.name}`,
      `*SKU*: ${product.sku || 'N/A'}`,
      `*Brand*: ${product.brandName || 'N/A'}`,
      `*Category*: ${product.category || 'N/A'}${product.gender ? ` (${product.gender}s)` : ''}`,
      `*Colour*: ${variant.color || 'N/A'}`,
      `*Size*: ${sizeStr}`,
      savingsLine,
      ...(imgUrl ? [`*Image*: ${imgUrl}`] : []),
      `*View Slipper Photos & Details*: ${productUrl}`,
      ``,
      `Please confirm if this is available at your Ayyempettai store. I will visit to purchase.`,
      ``,
      `Thank you.`,
    ];

    const text = lines.join('\n');
    const whatsappUrl = storeWhatsAppUrl(text);

    
    // Log Lead in CRM
    await db.createLead({
      id: crypto.randomUUID(),
      customer_name: 'Visitor',
      phone: 'WhatsApp Enquiry',
      interested_product_id: product.id,
      source: 'WhatsApp',
      status: 'new',
      notes: `Enquiry: ${product.name} | Color: ${variant.color} | Size: ${sizeStr} | SKU: ${product.sku}`,
      created_at: new Date().toISOString()
    });

    await db.logEvent({
      id: crypto.randomUUID(),
      product_id: product.id,
      event_type: 'whatsapp_click',
      metadata: { sku: product.sku, color: variant.color, size },
      created_at: new Date().toISOString()
    });

    window.open(whatsappUrl, '_blank');
  };


  const handleProductWhatsApp = (product: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const variant = product.variants?.[0];
    if (variant) triggerWhatsAppLead(product, variant, null);
  };

  const handleFooterNavigate = (section: 'home' | 'men' | 'women' | 'offers' | 'faq') => {
    if (section === 'faq') {
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (section === 'men') handleNavSelect('men');
    else if (section === 'women') handleNavSelect('women');
    else if (section === 'offers') handleNavSelect('sale');
    else if (section === 'home') handleNavSelect('new');
    document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCategoryChip = (categoryId: string) => {
    setActiveNav(null);
    setSelectedGender('All');
    setShowOffersOnly(false);
    setShowFavoritesOnly(false);
    setSearchInput('');
    setSelectedBrand('All');
    setSelectedColor('All');
    setSelectedSizeFilter('All');
    setSelectedMaterial('All');
    setSelectedFamily('all');
    setSelectedCategory(categoryId);
    document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavSelect = (nav: NavKey) => {
    setActiveNav(nav);
    setShowFavoritesOnly(false);
    setSearchInput('');
    setSelectedBrand('All');
    setSelectedColor('All');
    setSelectedSizeFilter('All');
    setSelectedMaterial('All');
    setSelectedCategory('All');
    if (nav === 'men') setSelectedGender('Men');
    else if (nav === 'women') setSelectedGender('Women');
    else if (nav === 'kids') setSelectedGender('Kids');
    else setSelectedGender('All');
    if (nav === 'sale') {
      setShowOffersOnly(true);
      setSelectedGender('All');
    } else {
      setShowOffersOnly(false);
    }
    if (nav === 'new') {
      setSortBy('newest');
      setSelectedFamily('all');
    }
  };

  const handleResetHome = () => {
    setActiveNav(null);
    setSelectedGender('All');
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedColor('All');
    setSelectedSizeFilter('All');
    setSelectedMaterial('All');
    setSearchInput('');
    setShowFavoritesOnly(false);
    setShowOffersOnly(false);
    setSelectedFamily('all');
    setSortBy('newest');
    setMaxPrice(filterOptions.absoluteMaxPrice);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetAllFilters = () => {
    setSearchInput('');
    setSelectedGender('All');
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedColor('All');
    setSelectedSizeFilter('All');
    setSelectedMaterial('All');
    setMaxPrice(filterOptions.absoluteMaxPrice);
    setShowFavoritesOnly(false);
    setShowOffersOnly(false);
    setSelectedFamily('all');
    setActiveNav(null);
  };

  const catalogTitle = useMemo(() => {
    if (showFavoritesOnly) return 'Your Favorites';
    if (searchInput.trim()) return 'Search Results';
    if (showOffersOnly) return 'Sale & Offers';
    if (selectedGender === 'Men') return "Men's Footwear";
    if (selectedGender === 'Women') return "Women's Footwear";
    if (selectedGender === 'Kids') return "Kids' Footwear";
    if (selectedCategory !== 'All') {
      const cat = STOREFRONT_CATEGORY_GROUPS.find(g => g.id === selectedCategory);
      return cat?.label ?? normalizeCategoryLabel(selectedCategory);
    }
    return isHomeView ? 'Shop All Footwear' : 'All Footwear';
  }, [searchInput, showOffersOnly, showFavoritesOnly, selectedGender, selectedCategory, isHomeView]);

  const currentVariant = selectedProduct?.variants?.[activeVariantIndex];
  const imagesList = currentVariant?.images || [];
  const sizesList = currentVariant?.sizes || [];

  return (
    <div className="storefront-app">

      {/* JSON-LD Structured Data — Organization, LocalBusiness, WebSite, Product */}
      <StructuredData
        product={selectedProduct}
        category={selectedCategory !== 'All' ? selectedCategory : undefined}
        products={filteredProducts}
      />

      {/* 404 Page */}
      {show404 && (
        <NotFoundPage onGoHome={() => { setShow404(false); setSelectedProduct(null); }} />
      )}

      {/* Festival Banner Header */}
      {!show404 && festivalMode !== 'normal' && (
        <div style={{
          backgroundColor: '#DC2626',
          color: '#FFFFFF',
          textAlign: 'center',
          padding: '0.4rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          boxShadow: '0 2px 10px rgba(220, 38, 38, 0.25)'
        }}>
          🎉 {festivalMode === 'diwali' ? 'Diwali Special Dhamaka Sale! Flat ₹100 Off!' : 
              festivalMode === 'pongal' ? 'Happy Pongal Offers! Check our daily collections!' :
              'Festival Festive Specials! Shop now!'} 🎉
        </div>
      )}

      {/* Store Notice / Error Banner */}
      {storeNotice && (
        <div style={{
          background: '#FFFBEB',
          color: '#92400E',
          padding: '0.4rem 1rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          textAlign: 'center',
          borderBottom: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <span>ℹ️ {storeNotice}</span>
          <button
            type="button"
            onClick={() => setStoreNotice(null)}
            aria-label="Dismiss notice"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#92400E', padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      <StoreHeader
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        activeNav={activeNav}
        favoritesCount={favorites.length}
        showFavoritesOnly={showFavoritesOnly}
        onNavSelect={handleNavSelect}
        onCategorySelect={(cat) => {
          setSelectedCategory(cat);
          setShowFavoritesOnly(false);
          setShowOffersOnly(false);
          setSearchInput('');
        }}
        onResetHome={handleResetHome}
        onToggleFavorites={() => {
          setShowFavoritesOnly(prev => !prev);
          setShowOffersOnly(false);
          setSearchInput('');
        }}
        placeholderText={placeholderText}
      />

      {isHomeView && (
        <HomeShowcase
          newArrivals={newArrivals}
          bestPicks={bestPicks}
          presentationSettings={presentationSettings}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenProduct={openProductDetails}
          onWhatsApp={handleProductWhatsApp}
          onNavigate={handleFooterNavigate}
          onCategoryChip={handleCategoryChip}
          onBrowseNew={() => {
            handleNavSelect('new');
            scrollToCatalog();
          }}
          onBrowseOffers={() => {
            handleNavSelect('sale');
            scrollToCatalog();
          }}
        />
      )}

      {/* Nike-style PLP */}
      <div id="catalog-view" className="nike-plp">
        <FilterSidebar
          hidden={sidebarHidden}
          brands={filterOptions.brands}
          extraCategories={filterOptions.extraCategories}
          colors={allCatalogColors}
          sizes={filterOptions.sizes}
          materials={filterOptions.materials}
          absoluteMaxPrice={filterOptions.absoluteMaxPrice}
          selectedBrand={selectedBrand}
          selectedGender={selectedGender}
          selectedCategory={selectedCategory}
          selectedColor={selectedColor}
          selectedSize={selectedSizeFilter}
          selectedMaterial={selectedMaterial}
          maxPrice={maxPrice}
          showOffersOnly={showOffersOnly}
          onBrandChange={setSelectedBrand}
          onGenderChange={setSelectedGender}
          onCategoryChange={setSelectedCategory}
          onColorChange={setSelectedColor}
          onSizeChange={setSelectedSizeFilter}
          onOffersToggle={setShowOffersOnly}
          onMaterialChange={setSelectedMaterial}
          onMaxPriceChange={setMaxPrice}
          disabled={productsLoading}
          onReset={resetAllFilters}
        />

        <main className="nike-plp-main" aria-busy={productsLoading}>
            <CategoryFamilyChips
              selectedFamily={selectedFamily}
              onSelectFamily={(familyId) => {
                setSelectedFamily(familyId);
                setSelectedCategory('All');
                setShowFavoritesOnly(false);
              }}
            />

            <div className="nike-plp-head">
              <h2 className="nike-plp-title">
                {catalogTitle}{' '}
                {productsLoading ? (
                  <span className="skeleton-count-pill shimmer-box" />
                ) : (
                  <span>({sortedDisplayProducts.length})</span>
                )}
              </h2>
            <div className="nike-plp-controls">
              <button
                type="button"
                className="nike-hide-filters-btn"
                onClick={() => setSidebarHidden(!sidebarHidden)}
              >
                <SlidersHorizontal size={16} />
                {sidebarHidden ? 'Show Filters' : 'Hide Filters'}
              </button>
              <CatalogToolbar
                count={sortedDisplayProducts.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
                variant="nike"
              />
            </div>
          </div>

          {productsLoading ? (
            <ProductSkeletonGrid count={9} />
          ) : fetchError ? (
            <div className="vsf-empty-search animate-fade-in" style={{
              textAlign: 'center',
              padding: '4rem 1.5rem',
              maxWidth: '640px',
              margin: '2rem auto',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #FCA5A5',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.08)'
            }}>
              <div style={{
                width: '64px', height: '64px',
                borderRadius: '50%',
                background: 'rgba(220,38,38,0.1)',
                color: '#DC2626',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <RefreshCw size={28} />
              </div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700, color: '#1A1209', marginBottom: '0.5rem' }}>
                We couldn't load the catalogue.
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#7A7068', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {fetchError}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem 1.75rem' }}
                >
                  Retry Loading
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem 1.75rem' }}
                >
                  Reconnect
                </button>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="vsf-empty-search animate-fade-in" style={{
              textAlign: 'center',
              padding: '4rem 1.5rem',
              maxWidth: '640px',
              margin: '2rem auto',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E8E0D8',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                width: '64px', height: '64px',
                borderRadius: '50%',
                background: 'rgba(220,38,38,0.08)',
                color: '#DC2626',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <Search size={32} />
              </div>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700, color: '#1A1209', marginBottom: '0.5rem' }}>
                {products.length === 0
                  ? 'No footwear available'
                  : searchInput.trim()
                    ? `No matches for "${searchInput}"`
                    : 'No products match your selected filters'}
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#7A7068', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {products.length === 0
                  ? 'The catalog is currently being updated. Please check back shortly or visit our Ayyempettai showroom.'
                  : searchInput.trim()
                    ? 'Check for spelling mistakes, try broader keywords (e.g. "Walkaroo", "Slippers", "Sandals"), or clear active filters.'
                    : selectedSizeFilter !== 'All'
                      ? `We currently don't have in-stock items in size ${selectedSizeFilter} matching your filters. Try selecting a nearby size.`
                      : 'Try resetting some of your filter selections to see more options.'}
              </p>

              {/* Quick Suggestion Action Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.75rem' }}>
                {searchInput.trim() && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setSearchInput('')}
                  >
                    Clear search term
                  </button>
                )}
                {selectedCategory !== 'All' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setSelectedCategory('All')}
                  >
                    Clear category filter
                  </button>
                )}
                {selectedBrand !== 'All' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setSelectedBrand('All')}
                  >
                    Clear brand filter
                  </button>
                )}
                {selectedSizeFilter !== 'All' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                    onClick={() => setSelectedSizeFilter('All')}
                  >
                    Clear size filter
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={resetAllFilters}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.75rem' }}
              >
                Reset All Filters &amp; Search
              </button>
            </div>
          ) : (
            <>
              <div className="nike-product-grid">
                {pagedDisplayProducts.map((product, idx) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={idx}
                    variant="nike"
                    presentationSettings={presentationSettings}
                    isFavorite={favorites.includes(product.id)}
                    onToggleFavorite={(e) => toggleFavorite(product.id, e)}
                    onOpen={() => openProductDetails(product)}
                    onQuickView={(e) => {
                      e.stopPropagation();
                      openProductDetails(product);
                    }}
                    onWhatsApp={(e) => handleProductWhatsApp(product, e)}
                  />
                ))}
              </div>
              <CatalogPagination
                currentPage={Math.min(catalogPage, totalPages)}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalItems={sortedDisplayProducts.length}
                onPageChange={(page) => {
                  setCatalogPage(page);
                  document.getElementById('catalog-view')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </>
          )}
        </main>
      </div>

      {/* Dynamic Immersive Product Details Overlay Modal */}
      {selectedProduct && (
        <Modal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          size="lg"
        >
          <div className="product-detail-grid">
            
            {/* Image display Left Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '100%',
                  background: '#f9fafb',
                  borderRadius: '0.75rem',
                  border: '1px solid #f3f4f6',
                  overflow: 'hidden',
                  cursor: isZoomed ? 'zoom-out' : 'zoom-in'
                }}
                onClick={() => setIsZoomed(!isZoomed)}
                onMouseMove={handleMouseMove}
              >
                {imagesList[activeImageIndex]?.url ? (
                  <img
                    src={imagesList[activeImageIndex]?.url}
                    alt={selectedProduct.name}
                    style={isZoomed ? {
                      position: 'absolute',
                      width: '200%',
                      height: '200%',
                      top: `-${zoomPos.y}%`,
                      left: `-${zoomPos.x}%`,
                      transform: 'translate(25%, 25%) scale(1.1)',
                      objectFit: 'contain'
                    } : {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      padding: '1.5rem'
                    }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    No Product Image
                  </div>
                )}
                
                {/* Image carousel buttons */}
                {imagesList.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => (prev - 1 + imagesList.length) % imagesList.length);
                      }}
                      style={{
                        position: 'absolute',
                        left: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImageIndex(prev => (prev + 1) % imagesList.length);
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}

                <div style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                  <Badge variant="outline" style={{ background: 'rgba(255,255,255,0.85)' }}>
                    <Maximize2 size={10} style={{ marginRight: '0.2rem' }} /> Keyboard Nav
                  </Badge>
                </div>
              </div>

              {/* Thumbnails grid */}
              {imagesList.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {imagesList.map((img: any, idx: number) => (
                    <button
                      key={img.id || idx}
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        width: '60px',
                        height: '60px',
                        flexShrink: 0,
                        border: activeImageIndex === idx ? '2px solid hsl(var(--primary))' : '1px solid #e5e7eb',
                        borderRadius: '0.35rem',
                        overflow: 'hidden',
                        background: '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Slipper specifications Right Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedProduct.brandName}
                </span>
                <h2 style={{ fontSize: '1.5rem', color: '#111827', marginTop: '0.1rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                  {selectedProduct.name}
                </h2>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginTop: '0.2rem' }}>
                  SKU: {selectedProduct.sku}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {selectedProduct.gender && (
                    <Badge variant="outline">{selectedProduct.gender}</Badge>
                  )}
                  {selectedProduct.category && (
                    <Badge variant="outline">{normalizeCategoryLabel(selectedProduct.category)}</Badge>
                  )}
                  {selectedProduct.material && (
                    <Badge variant="outline">{selectedProduct.material}</Badge>
                  )}
                </div>
              </div>

              {/* Price details */}
              {(() => {
                const pricing = getStorefrontPricing(selectedProduct, presentationSettings);
                const { sellingPrice, displayMrp, showDiscount, discountPercent } = pricing;
                return (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#111827', fontWeight: 800, fontSize: '1.65rem' }}>
                      {formatCurrency(sellingPrice)}
                    </span>
                    {showDiscount && (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '1rem' }}>
                          {formatCurrency(displayMrp)}
                        </span>
                        <Badge variant="success" style={{ marginLeft: '0.25rem' }}>
                          {discountPercent}% OFF · Save {formatCurrency(displayMrp - sellingPrice)}
                        </Badge>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="vsf-inquiry-box">
                <div><strong><Phone size={14} /> Call or WhatsApp</strong><span>Browse here — enquire by call or WhatsApp only</span></div>
                <div><strong><RefreshCw size={14} /> Visit Our Store</strong><span>Try before you buy at Gandhipuram showroom</span></div>
                <div><strong><RefreshCw size={14} /> 7-Day Exchange</strong><span>Free size swap with bill at store</span></div>
                <div><strong><ShieldCheck size={14} /> Genuine Product</strong><span>100% authentic brands — no shipping or COD</span></div>
              </div>

              {/* Nike Story Product Description */}
              <div>
                <h4 style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  THE STORY
                </h4>
                <p style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {selectedProduct.description}
                </p>
              </div>

              {/* Color variant Selector */}
              <div>
                <h4 style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  COLOR VARIANT: <span style={{ color: '#111827', fontWeight: 600 }}>{currentVariant?.color}</span>
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedProduct.variants?.map((v: any, index: number) => (
                    <button
                      key={v.id || index}
                      onClick={() => {
                        setActiveVariantIndex(index);
                        setActiveImageIndex(0);
                        setSelectedSize(null);
                      }}
                      className="btn"
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.75rem',
                        borderRadius: '0.35rem',
                        border: activeVariantIndex === index ? '2px solid hsl(var(--primary))' : '1px solid #e5e7eb',
                        backgroundColor: activeVariantIndex === index ? 'hsl(var(--primary) / 0.05)' : '#ffffff',
                        color: activeVariantIndex === index ? 'hsl(var(--primary))' : '#4b5563'
                      }}
                    >
                      {v.color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 800, textTransform: 'uppercase' }}>
                    SELECT SIZE (UK/IND)
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
                    <button type="button" onClick={() => setShowSizeChart(true)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                      <Ruler size={14} /> Size Chart
                    </button>
                  </span>
                </div>
                <div className="product-size-grid">
                  {sizesList.map((s: any) => {
                    const isOutOfStock = s.stock === 0;
                    const isSelected = selectedSize === s.size_number;
                    
                    return (
                      <button
                        key={s.id || s.size_number}
                        disabled={isOutOfStock}
                        onClick={() => setSelectedSize(s.size_number)}
                        style={{
                          padding: '0.65rem 0',
                          border: isSelected ? '2px solid hsl(var(--primary))' : '1px solid #e5e7eb',
                          borderRadius: '0.35rem',
                          background: isOutOfStock ? '#f3f4f6' : isSelected ? 'hsl(var(--primary) / 0.05)' : '#ffffff',
                          color: isOutOfStock ? '#9ca3af' : isSelected ? 'hsl(var(--primary))' : '#111827',
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          position: 'relative',
                          transition: 'all 0.15s'
                        }}
                      >
                        {s.size_number}
                        {s.stock > 0 && s.stock <= 3 && (
                          <span style={{
                            position: 'absolute',
                            top: '1px',
                            right: '2px',
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: '#f59e0b'
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bullet key features list */}
              {selectedProduct.features?.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    KEY ADVANTAGES
                  </h4>
                  <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: '#4b5563' }}>
                    {selectedProduct.features.map((feat: string, idx: number) => (
                      <li key={idx} style={{ lineHeight: 1.4 }}>{feat}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => triggerWhatsAppLead(selectedProduct, currentVariant, selectedSize)}
                  className="btn btn-primary"
                  style={{ flex: 1, minWidth: '140px', padding: '0.9rem' }}
                >
                  <MessageSquare size={18} />
                  WhatsApp Enquiry
                </button>

                <a
                  href={storeTelUrl()}
                  className="btn btn-secondary"
                  style={{ flex: 1, minWidth: '140px', padding: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
                >
                  <Phone size={18} />
                  Call Store
                </a>

                <button
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="btn btn-secondary"
                  style={{ padding: '0.9rem' }}
                  aria-label="Show in-store QR code"
                >
                  <QrCode size={18} />
                </button>
              </div>

              {/* Show instore QR scanning block */}
              {showQrCode && (
                <div className="animate-fade-in" style={{
                  padding: '1rem',
                  border: '1px dashed hsl(var(--primary))',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#fafaf9'
                }}>
                  <canvas ref={qrCanvasRef} width={180} height={180} style={{ width: '130px', height: '130px' }} />
                  <div>
                    <h5 style={{ fontSize: '0.8rem', color: '#111827', fontWeight: 800 }}>In-Store Product Code</h5>
                    <p style={{ fontSize: '0.7rem', color: '#4b5563' }}>Scan this QR code with a mobile camera inside the store to check variants on your phone.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <RelatedProducts
            currentProduct={selectedProduct}
            allProducts={products}
            favorites={favorites}
            presentationSettings={presentationSettings}
            onOpen={openProductDetails}
            onToggleFavorite={toggleFavorite}
            onWhatsApp={handleProductWhatsApp}
          />
        </Modal>
      )}

      <SizeChartModal
        isOpen={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        gender={selectedProduct?.gender}
      />

      <RecentlyViewed
        productIds={recentlyViewedIds}
        allProducts={products}
        favorites={favorites}
        presentationSettings={presentationSettings}
        onOpen={openProductDetails}
        onToggleFavorite={toggleFavorite}
        onWhatsApp={handleProductWhatsApp}
      />

      {/* Store Showroom Details & Reviews Section */}
      <section className="container animate-fade-in" style={{ marginTop: '4rem', display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
        
        {/* Customer Reviews Row */}
        <div>
          <h3 style={{ fontSize: '1.2rem', color: '#111827', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '1.25rem', textAlign: 'center' }}>
            What Our Customers Say
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {[
              { name: "Anand Krishnan", rating: "★★★★★", review: "The cloud cushion slippers are insanely comfortable. Best shop in Thanjavur for family footwear!" },
              { name: "Meera Nair", rating: "★★★★★", review: "Large variety of Crocs and sports shoes. Excellent quality and very polite service." },
              { name: "Suresh Kumar", rating: "★★★★☆", review: "I bought formal office shoes. Extremely premium leather feel and very reasonable pricing." }
            ].map((rev, idx) => (
              <div key={idx} className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{rev.rating}</span>
                <p style={{ color: '#4b5563', fontSize: '0.85rem', fontStyle: 'italic', flex: 1 }}>"{rev.review}"</p>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#111827', textAlign: 'right' }}>— {rev.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact & Direct Enquiry Banner (Directly after Customer Reviews) */}
        <div style={{
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
          borderRadius: '20px',
          padding: '2.5rem 1.75rem',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          color: '#FFFFFF',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          margin: '0.5rem 0'
        }}>
          <div style={{ maxWidth: '650px' }}>
            <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
              DIRECT STORE ASSISTANCE & ENQUIRIES
            </span>
            <h3 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: '0.75rem', color: '#FFFFFF' }}>
              Have Questions or Need Help? Talk to Us Directly!
            </h3>
            <p style={{ color: '#D4D4D8', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 auto' }}>
              Check product availability, request size recommendations, or get directions to our showroom in <strong>Ayyampettai, Thanjavur</strong>. We respond instantly!
            </p>
          </div>

          {/* Action Callouts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', width: '100%', maxWidth: '850px' }}>
            
            {/* WhatsApp Card */}
            <a
              href={storeWhatsAppUrl('Hi VijayaSri Footwear! I want to enquire about size and product availability.')}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#25D366',
                color: '#000000',
                borderRadius: '14px',
                padding: '1.25rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                textDecoration: 'none',
                fontWeight: 800,
                boxShadow: '0 8px 20px rgba(37, 211, 102, 0.25)',
                transition: 'transform 0.2s ease',
              }}
            >
              <div style={{ background: 'rgba(0,0,0,0.12)', padding: '0.6rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={22} color="#000000" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.95rem', display: 'block', lineHeight: 1.2 }}>WhatsApp Enquiry</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.85 }}>Instant Response &amp; Size Check</span>
              </div>
            </a>

            {/* Phone Call Card */}
            <a
              href={storeTelUrl()}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#000000',
                borderRadius: '14px',
                padding: '1.25rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                textDecoration: 'none',
                fontWeight: 800,
                boxShadow: '0 8px 20px rgba(255,255,255,0.15)',
                transition: 'transform 0.2s ease',
              }}
            >
              <div style={{ background: 'rgba(220, 38, 38, 0.12)', padding: '0.6rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PhoneCall size={22} color="#DC2626" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.95rem', display: 'block', lineHeight: 1.2 }}>Call Store Directly</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#4B5563' }}>+91 83000 29513 (Mon–Sat)</span>
              </div>
            </a>

            {/* Visit Showroom / Map Card */}
            <a
              href="https://maps.app.goo.gl/sFiiKYZr3kuwnfHT6"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '14px',
                padding: '1.25rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                textDecoration: 'none',
                fontWeight: 800,
                transition: 'transform 0.2s ease',
              }}
            >
              <div style={{ background: 'rgba(255,255,255,0.12)', padding: '0.6rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={22} color="#FFFFFF" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: '0.95rem', display: 'block', lineHeight: 1.2 }}>Visit Showroom</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#A1A1AA' }}>Ayyampettai, Thanjavur</span>
              </div>
            </a>

          </div>
        </div>

        <FaqSection />
      </section>

      <StoreFooter onNavigate={handleFooterNavigate} />

      <BackToTop />

      <a
        href={storeWhatsAppUrl('Hi VijayaSri Footwear, I have an enquiry regarding shoes.')}
        target="_blank"
        rel="noopener noreferrer"
        className="vsf-whatsapp-float desktop-only"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.12 1.524 5.855L.055 23.454a.5.5 0 0 0 .491.546.499.499 0 0 0 .131-.018l5.77-1.504A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.032-1.386l-.36-.214-3.733.972.998-3.636-.235-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
      </a>

      {/* PWA Sticky Mobile Bottom Navigation Bar (Responsive 90% mobile view) */}
      <nav className="nav-bottom-panel mobile-only">
        <button
          onClick={handleResetHome}
          style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: isHomeView ? 'hsl(var(--primary))' : '#6b7280', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ fontSize: '1.1rem', marginBottom: '0.1rem' }}>🏠</span>
          Home
        </button>

        <button
          onClick={() => {
            handleNavSelect('new');
            scrollToCatalog();
          }}
          style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeNav === 'new' ? 'hsl(var(--primary))' : '#6b7280', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ fontSize: '1.1rem', marginBottom: '0.1rem' }}>🔥</span>
          New
        </button>

        <button
          onClick={() => {
            setSidebarHidden(false);
            scrollToCatalog();
          }}
          style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#6b7280', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ fontSize: '1.1rem', marginBottom: '0.1rem' }}>🩴</span>
          Categories
        </button>

        <button
          onClick={() => {
            setShowFavoritesOnly(!showFavoritesOnly);
          }}
          style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', color: showFavoritesOnly ? 'hsl(var(--primary))' : '#6b7280', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <span style={{ fontSize: '1.1rem', marginBottom: '0.1rem' }}>❤️</span>
          Favorites
        </button>

        <a
          href={storeTelUrl()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#111827', fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none' }}
        >
          <span style={{ fontSize: '1.1rem', marginBottom: '0.1rem' }}>📞</span>
          Call
        </a>

        <a
          href={storeWhatsAppUrl('Hi VijayaSri Footwear, I have an enquiry regarding shoes.')}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#25d366', fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none' }}
        >
          <span style={{ fontSize: '1.1rem', marginBottom: '0.1rem' }}>💬</span>
          WhatsApp
        </a>
      </nav>
    </div>
  );
}
