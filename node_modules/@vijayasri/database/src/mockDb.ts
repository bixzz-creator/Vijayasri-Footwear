import {
  Branch, Brand, Product, ProductFeature, ProductTag, ProductCollection,
  ProductVariant, ProductImage, VariantSize,
  Lead, AnalyticsEvent, DailyAnalyticsSummary, HomepageLayout
} from '@vijayasri/shared';

// Setup Mock Store names
const STORES = {
  BRANCHES: 'branches',
  BRANDS: 'brands',
  PRODUCTS: 'products',
  FEATURES: 'product_features',
  TAGS: 'product_tags',
  COLLECTIONS: 'product_collections',
  VARIANTS: 'product_variants',
  IMAGES: 'product_images',
  SIZES: 'variant_sizes',
  TRANSACTIONS: 'inventory_transactions',
  LEADS: 'leads',
  ANALYTICS: 'analytics_events',
  ANALYTICS_SUMMARIES: 'daily_analytics_summary',
  LAYOUTS: 'homepage_layouts',
  ACTIVITY_LOGS: 'activity_logs'
};

export class MockDB {
  private dbName = 'vijayasri_offline_db';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
      
      request.onsuccess = async () => {
        this.db = request.result;
        await this.seedDataIfEmpty();
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async getById<T>(storeName: string, id: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async put<T>(storeName: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const req = store.put(data);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async delete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Branch CRUD
  async getBranches(): Promise<Branch[]> {
    return this.getAll<Branch>(STORES.BRANCHES);
  }

  // Brands CRUD
  async getBrands(): Promise<Brand[]> {
    return this.getAll<Brand>(STORES.BRANDS);
  }

  async saveBrand(brand: Brand): Promise<void> {
    await this.put(STORES.BRANDS, brand);
  }

  // Products and Joins
  async getProducts(): Promise<Product[]> {
    return this.getAll<Product>(STORES.PRODUCTS);
  }

  async findProductByCompositeHash(compositeHash: string): Promise<string | null> {
    const allVariants = await this.getAll<ProductVariant>(STORES.VARIANTS);
    const match = allVariants.find(v => v.composite_hash === compositeHash);
    return match?.product_id ?? null;
  }

  async getProduct(id: string) {
    const product = await this.getById<Product>(STORES.PRODUCTS, id);
    if (!product) return null;

    // Fetch related tables
    const allFeatures = await this.getAll<ProductFeature>(STORES.FEATURES);
    const allTags = await this.getAll<ProductTag>(STORES.TAGS);
    const allColls = await this.getAll<ProductCollection>(STORES.COLLECTIONS);
    const allVariants = await this.getAll<ProductVariant>(STORES.VARIANTS);
    const allImages = await this.getAll<ProductImage>(STORES.IMAGES);
    const allSizes = await this.getAll<VariantSize>(STORES.SIZES);

    const features = allFeatures.filter(f => f.product_id === id).map(f => f.feature_text);
    const tags = allTags.filter(t => t.product_id === id).map(t => t.tag);
    const collections = allColls.filter(c => c.product_id === id).map(c => c.collection_name);
    
    const productVariants = allVariants.filter(v => v.product_id === id);
    const enrichedVariants = await Promise.all(productVariants.map(async v => {
      const images = allImages.filter(img => img.variant_id === v.id);
      const sizes = allSizes.filter(s => s.variant_id === v.id);
      return {
        ...v,
        images: images.sort((a, b) => a.sort_order - b.sort_order),
        sizes: sizes.sort((a, b) => a.size_number - b.size_number)
      };
    }));

    const brand = await this.getById<Brand>(STORES.BRANDS, product.brand_id);

    return {
      ...product,
      brandName: brand ? brand.name : 'Unknown',
      brandLogo: brand ? brand.logo_url : null,
      features,
      tags,
      collections,
      variants: enrichedVariants
    };
  }

  async saveProduct(
    product: Product,
    features: string[],
    tags: string[],
    collections: string[],
    variants: Array<{
      color: string;
      compositeHash: string;
      images: Array<{ url: string; is_primary: boolean; sort_order: number }>;
      sizes: Array<{ size_number: number; stock: number }>;
    }>,
    brandName?: string
  ): Promise<void> {
    const targetBrand = brandName ? brandName.trim() : 'Generic';
    const brands = await this.getBrands();
    let existingBrand = brands.find(b => b.name.toLowerCase() === targetBrand.toLowerCase());
    if (!existingBrand) {
      existingBrand = {
        id: crypto.randomUUID(),
        name: targetBrand,
        logo_url: null,
        slug: targetBrand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        created_at: new Date().toISOString()
      };
      await this.saveBrand(existingBrand);
    }
    product.brand_id = existingBrand.id;

    if (variants.length > 0 && variants[0].compositeHash) {
      const existingId = await this.findProductByCompositeHash(variants[0].compositeHash);
      if (existingId && existingId !== product.id) {
        product.id = existingId;
      }
    }

    // 1. Save product
    await this.put(STORES.PRODUCTS, product);

    // 2. Refresh features, tags, and collections (delete then put)
    const allFeatures = await this.getAll<ProductFeature>(STORES.FEATURES);
    for (const f of allFeatures.filter(x => x.product_id === product.id)) {
      await this.delete(STORES.FEATURES, f.id);
    }
    for (const fText of features) {
      await this.put(STORES.FEATURES, {
        id: crypto.randomUUID(),
        product_id: product.id,
        feature_text: fText
      });
    }

    const allTags = await this.getAll<ProductTag>(STORES.TAGS);
    for (const t of allTags.filter(x => x.product_id === product.id)) {
      await this.delete(STORES.TAGS, t.id);
    }
    for (const tag of tags) {
      await this.put(STORES.TAGS, {
        id: crypto.randomUUID(),
        product_id: product.id,
        tag
      });
    }

    const allColls = await this.getAll<ProductCollection>(STORES.COLLECTIONS);
    for (const c of allColls.filter(x => x.product_id === product.id)) {
      await this.delete(STORES.COLLECTIONS, c.id);
    }
    for (const col of collections) {
      await this.put(STORES.COLLECTIONS, {
        id: crypto.randomUUID(),
        product_id: product.id,
        collection_name: col
      });
    }

    // 3. Process Variants
    // Delete existing variants for this product
    const allVariants = await this.getAll<ProductVariant>(STORES.VARIANTS);
    const existingVariants = allVariants.filter(v => v.product_id === product.id);
    const allImages = await this.getAll<ProductImage>(STORES.IMAGES);
    const allSizes = await this.getAll<VariantSize>(STORES.SIZES);

    for (const ev of existingVariants) {
      // Remove images
      const imagesToDelete = allImages.filter(x => x.variant_id === ev.id);
      for (const img of imagesToDelete) await this.delete(STORES.IMAGES, img.id);
      // Remove sizes
      const sizesToDelete = allSizes.filter(x => x.variant_id === ev.id);
      for (const size of sizesToDelete) await this.delete(STORES.SIZES, size.id);
      
      await this.delete(STORES.VARIANTS, ev.id);
    }

    // Save new variants
    for (const vData of variants) {
      const variantId = crypto.randomUUID();
      await this.put(STORES.VARIANTS, {
        id: variantId,
        product_id: product.id,
        color: vData.color,
        composite_hash: vData.compositeHash,
        created_at: new Date().toISOString()
      });

      // Save images
      for (const img of vData.images) {
        await this.put(STORES.IMAGES, {
          id: crypto.randomUUID(),
          variant_id: variantId,
          url: img.url,
          is_primary: img.is_primary,
          sort_order: img.sort_order
        });
      }

      // Save sizes and stock
      for (const sItem of vData.sizes) {
        const sizeId = crypto.randomUUID();
        await this.put(STORES.SIZES, {
          id: sizeId,
          variant_id: variantId,
          size_number: sItem.size_number,
          stock: sItem.stock,
          created_at: new Date().toISOString()
        });

        // Create an inventory transaction
        await this.put(STORES.TRANSACTIONS, {
          id: crypto.randomUUID(),
          variant_size_id: sizeId,
          transaction_type: 'PURCHASE',
          quantity: sItem.stock,
          created_at: new Date().toISOString()
        });
      }
    }
  }

  async deleteProduct(id: string): Promise<void> {
    await this.delete(STORES.PRODUCTS, id);
  }

  // Inventory Ledger Adjustments
  async adjustInventory(variantSizeId: string, type: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT', quantity: number): Promise<void> {
    const sizeRecord = await this.getById<VariantSize>(STORES.SIZES, variantSizeId);
    if (!sizeRecord) throw new Error('Size record not found');

    let delta = quantity;
    if (type === 'SALE') {
      delta = -quantity;
    } else if (type === 'ADJUSTMENT') {
      // Adjustment overrides stock or modifies it. Let's make adjustment modify it.
    }

    const newStock = Math.max(0, sizeRecord.stock + delta);
    sizeRecord.stock = newStock;
    await this.put(STORES.SIZES, sizeRecord);

    await this.put(STORES.TRANSACTIONS, {
      id: crypto.randomUUID(),
      variant_size_id: variantSizeId,
      transaction_type: type,
      quantity,
      created_at: new Date().toISOString()
    });
  }

  // CRM Leads
  async getLeads(): Promise<Lead[]> {
    return this.getAll<Lead>(STORES.LEADS);
  }

  async createLead(lead: Lead): Promise<void> {
    await this.put(STORES.LEADS, lead);
    await this.incrementSummaryCount('leads_count');
  }

  async updateLeadStatus(id: string, status: 'new' | 'contacted' | 'reserved' | 'sold' | 'closed'): Promise<void> {
    const lead = await this.getById<Lead>(STORES.LEADS, id);
    if (lead) {
      lead.status = status;
      await this.put(STORES.LEADS, lead);
    }
  }

  // Analytics logging
  async logEvent(event: AnalyticsEvent): Promise<void> {
    await this.put(STORES.ANALYTICS, event);
    if (event.event_type === 'view') {
      await this.incrementSummaryCount('views_count');
    } else if (event.event_type === 'whatsapp_click') {
      await this.incrementSummaryCount('whatsapp_clicks_count');
    } else if (event.event_type === 'phone_call') {
      await this.incrementSummaryCount('calls_count');
    }
  }

  private async incrementSummaryCount(field: 'views_count' | 'whatsapp_clicks_count' | 'calls_count' | 'leads_count'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const summaries = await this.getAll<DailyAnalyticsSummary>(STORES.ANALYTICS_SUMMARIES);
    let summary = summaries.find(s => s.summary_date === today);
    
    if (!summary) {
      summary = {
        id: crypto.randomUUID(),
        summary_date: today,
        views_count: 0,
        whatsapp_clicks_count: 0,
        calls_count: 0,
        leads_count: 0
      };
    }
    
    summary[field]++;
    await this.put(STORES.ANALYTICS_SUMMARIES, summary);
  }

  async getDailySummaries(): Promise<DailyAnalyticsSummary[]> {
    return this.getAll<DailyAnalyticsSummary>(STORES.ANALYTICS_SUMMARIES);
  }

  // Homepage Layout
  async getHomepageLayout(branchId: string): Promise<HomepageLayout> {
    const layouts = await this.getAll<HomepageLayout>(STORES.LAYOUTS);
    let layout = layouts.find(l => l.branch_id === branchId);
    if (!layout) {
      layout = {
        id: crypto.randomUUID(),
        branch_id: branchId,
        layout_json: {
          sections: ['hero', 'newArrivals', 'trending', 'categories', 'manual_collections']
        },
        festival_mode: 'normal',
        updated_at: new Date().toISOString()
      };
      await this.put(STORES.LAYOUTS, layout);
    }
    return layout;
  }

  async saveHomepageLayout(layout: HomepageLayout): Promise<void> {
    await this.put(STORES.LAYOUTS, layout);
  }

  // Activity Log
  async getLogs(): Promise<any[]> {
    return this.getAll(STORES.ACTIVITY_LOGS);
  }

  async logActivity(adminName: string, action: string, details: string): Promise<void> {
    await this.put(STORES.ACTIVITY_LOGS, {
      id: crypto.randomUUID(),
      admin_name: adminName,
      action,
      details,
      created_at: new Date().toISOString()
    });
  }

  // Prepopulate seed data
  private async seedDataIfEmpty(): Promise<void> {
    const products = await this.getAll<Product>(STORES.PRODUCTS);
    if (products.length > 0) return; // Database already seeded
    
    // 1. Add Default Branch
    const branchId = crypto.randomUUID();
    await this.put(STORES.BRANCHES, {
      id: branchId,
      name: 'VijayaSri Footwear (Main)',
      location: 'Trichy Road, Coimbatore',
      created_at: new Date().toISOString()
    });

    // 2. Add Brands
    const brandIds = {
      PUMA: crypto.randomUUID(),
      BATA: crypto.randomUUID(),
      SPARX: crypto.randomUUID(),
      VSF: crypto.randomUUID()
    };

    await this.put(STORES.BRANDS, { id: brandIds.PUMA, name: 'Puma', logo_url: null, slug: 'puma', created_at: new Date().toISOString() });
    await this.put(STORES.BRANDS, { id: brandIds.BATA, name: 'Bata', logo_url: null, slug: 'bata', created_at: new Date().toISOString() });
    await this.put(STORES.BRANDS, { id: brandIds.SPARX, name: 'Sparx', logo_url: null, slug: 'sparx', created_at: new Date().toISOString() });
    await this.put(STORES.BRANDS, { id: brandIds.VSF, name: 'VSF Premium', logo_url: null, slug: 'vsf-premium', created_at: new Date().toISOString() });

    // 3. Add initial products
    const seedProducts = [
      {
        id: crypto.randomUUID(),
        name: 'UltraComfort Cloud Slide',
        brand_id: brandIds.VSF,
        sku: 'VSF-MEN-SLD-VSF-0001',
        category: 'Slides',
        gender: 'Men' as const,
        material: 'EVA Foam',
        mrp: 699,
        offer_price: 499,
        description: 'Float through your day. Engineered with cloud-like EVA foam, this slide provides instant relief for tired feet. Sleek, minimal, essential.',
        features: [
          'Dual-density EVA foam midsole for maximum cushioning',
          'Contoured footbed matches the shape of your feet',
          'Slip-resistant textured tread pattern on outsole',
          'Waterproof and quick-drying, perfect for showers or poolside',
          'Ultra-lightweight design weighs less than 150 grams'
        ],
        tags: ['comfortable', 'soft', 'slides', 'cloud', 'eva'],
        collections: ['Daily Wear', 'Outdoor Collection'],
        variants: [
          {
            color: 'Midnight Black',
            compositeHash: 'hash-black-slipper',
            images: [
              // Inline SVG representation or a free placeholder
              { url: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=500&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 }
            ],
            sizes: [
              { size_number: 7, stock: 12 },
              { size_number: 8, stock: 25 },
              { size_number: 9, stock: 18 },
              { size_number: 10, stock: 2 } // triggers low stock warning!
            ]
          },
          {
            color: 'Navy Blue',
            compositeHash: 'hash-blue-slipper',
            images: [
              { url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 }
            ],
            sizes: [
              { size_number: 8, stock: 10 },
              { size_number: 9, stock: 0 } // triggers out of stock!
            ]
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Ladies Bubble Cushioned Slipper',
        brand_id: brandIds.BATA,
        sku: 'VSF-WMN-SLP-BAT-0002',
        category: 'Casual Slippers',
        gender: 'Women' as const,
        material: 'Rubber Foam',
        mrp: 499,
        offer_price: 399,
        description: 'Step into soft, bubbly bliss. Designed with a custom massage-bubble surface, these slippers gently soothe pressure points with every stride.',
        features: [
          'Massage bubbles relieve foot tension',
          'Durable non-marking natural rubber outer sole',
          'Flexible strap fits comfortably over high insteps',
          'Charming pastel shades',
          'Perfect for indoor living and daily house errands'
        ],
        tags: ['ladies', 'pink', 'massage', 'indoor', 'rubber'],
        collections: ['Daily Wear', 'Indoor Collection'],
        variants: [
          {
            color: 'Blush Pink',
            compositeHash: 'hash-pink-slipper',
            images: [
              { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&auto=format&fit=crop&q=80', is_primary: true, sort_order: 0 }
            ],
            sizes: [
              { size_number: 5, stock: 15 },
              { size_number: 6, stock: 20 },
              { size_number: 7, stock: 14 }
            ]
          }
        ]
      }
    ];

    for (const p of seedProducts) {
      const productObj: Product = {
        id: p.id,
        branch_id: branchId,
        brand_id: p.brand_id,
        sku: p.sku,
        barcode: null,
        name: p.name,
        gender: p.gender,
        category: p.category,
        material: p.material,
        mrp: p.mrp,
        offer_price: p.offer_price,
        description: p.description,
        status: 'published' as const,
        ai_prompt_version: 'v1',
        ai_confidence_score: 95,
        ai_analysis_details: {
          brandStatus: 'exact' as const,
          modelStatus: 'certain' as const,
          categoryStatus: 'certain' as const,
          materialStatus: 'certain' as const
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await this.saveProduct(productObj, p.features, p.tags, p.collections, p.variants);
    }
    
    // Seed some mock analytics logs for graphs
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      await this.put(STORES.ANALYTICS_SUMMARIES, {
        id: crypto.randomUUID(),
        summary_date: dateStr,
        views_count: Math.floor(Math.random() * 50) + 20,
        whatsapp_clicks_count: Math.floor(Math.random() * 15) + 3,
        calls_count: Math.floor(Math.random() * 5) + 1,
        leads_count: Math.floor(Math.random() * 3) + 1
      });
    }
  }
}
