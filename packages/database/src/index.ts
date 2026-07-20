import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MockDB } from './mockDb';
import { loadCredentials, cleanUrlValue, cleanHeaderValue } from './credentials';
import { loadPublicStorefrontConfig } from './publicConfig';
import {
  Branch, Brand, Product, Lead, AnalyticsEvent,
  DailyAnalyticsSummary, HomepageLayout
} from '@vijayasri/shared';
import {
  assertUuid,
  buildBrandSlug,
  logImporterBranchResolution,
  logImporterBrandResolution,
  normalizeBrandAndModel,
} from './importer';

export * from './credentials';
export * from './crypto';
export * from './importer';
export * from './publicConfig';

class DatabaseService {
  private client: SupabaseClient | null = null;
  private mockDb: MockDB;
  private isDemoMode: boolean = true;
  private cachedBranchId: string | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor() {
    this.mockDb = new MockDB();
  }

  /** Ensures IndexedDB mock layer is open before any demo-mode operation. */
  private ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.mockDb.init().catch(err => {
        this.readyPromise = null;
        throw err;
      });
    }
    return this.readyPromise;
  }

  async init(passcode?: string, customUrl?: string, customKey?: string): Promise<{ demoMode: boolean }> {
    this.cachedBranchId = null; // reset cached branch ID on re-init
    await this.ensureReady();
    
    // Check custom params or environment variables first
    const envUrl = cleanUrlValue(customUrl || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined));
    const envKey = cleanHeaderValue(customKey || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined));

    if (envUrl && envKey && envUrl.startsWith('http')) {
      this.client = createClient(envUrl, envKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      this.isDemoMode = false;
      console.log('[Database] Connected to live Supabase database via env variables');
      return { demoMode: false };
    }

    if (!passcode) {
      this.isDemoMode = true;
      return { demoMode: true };
    }

    try {
      const creds = await loadCredentials(passcode);
      const url = cleanUrlValue(creds?.supabaseUrl);
      const key = cleanHeaderValue(creds?.supabaseAnonKey);

      if (url && key && url.startsWith('http')) {
        this.client = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        this.isDemoMode = false;
        return { demoMode: false };
      }
    } catch (e) {
      console.warn('Failed to load credentials. Reverting to Demo Mode.', e);
    }

    this.isDemoMode = true;
    return { demoMode: true };
  }

  /**
   * Storefront bootstrap: connect to Supabase via env vars or saved public config.
   * Never falls back to demo/mock catalog data.
   */
  async initStorefront(
    supabaseUrl?: string,
    supabaseAnonKey?: string
  ): Promise<{ demoMode: boolean; source: 'env' | 'localStorage' | 'none' }> {
    this.cachedBranchId = null;
    await this.ensureReady();

    const stored = loadPublicStorefrontConfig();
    const url = cleanUrlValue(supabaseUrl || stored?.supabaseUrl);
    const key = cleanHeaderValue(supabaseAnonKey || stored?.supabaseAnonKey);

    if (url && key && url.startsWith('http')) {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      this.isDemoMode = false;
      const source = supabaseUrl && supabaseAnonKey ? 'env' : 'localStorage';
      console.log(`[Storefront] Connected to Supabase (${source})`);
      return { demoMode: false, source };
    }

    this.client = null;
    this.isDemoMode = true;
    console.warn(
      '[Storefront] No Supabase config found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, ' +
      'or save Supabase keys in the Admin panel (same browser origin).'
    );
    return { demoMode: true, source: 'none' };
  }

  private mapProductRow(p: any): any {
    return {
      ...p,
      brandName: p.brands?.name || 'Unknown',
      brandLogo: p.brands?.logo_url || null,
      features: p.product_features?.map((f: any) => f.feature_text) || [],
      tags: p.product_tags?.map((t: any) => t.tag) || [],
      collections: p.product_collections?.map((c: any) => c.collection_name) || [],
      variants: p.product_variants?.map((v: any) => ({
        ...v,
        images: v.product_images?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [],
        sizes: v.variant_sizes?.sort((a: any, b: any) => a.size_number - b.size_number) || []
      })) || []
    };
  }

  private dedupeStorefrontProducts(products: any[]): any[] {
    const seenIds = new Set<string>();
    const seenHashes = new Set<string>();
    const sorted = [...products].sort(
      (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    const unique: any[] = [];
    for (const p of sorted) {
      if (seenIds.has(p.id)) continue;
      const hash = p.variants?.[0]?.composite_hash as string | undefined;
      if (hash) {
        if (seenHashes.has(hash)) {
          console.warn(`[Storefront] Hiding duplicate listing ${p.id} (hash ${hash})`);
          continue;
        }
        seenHashes.add(hash);
      }
      seenIds.add(p.id);
      unique.push(p);
    }
    return unique;
  }

  private countProductImages(products: any[]): number {
    let count = 0;
    for (const p of products) {
      for (const v of p.variants || []) {
        count += v.images?.length || 0;
      }
    }
    return count;
  }

  /** Fetch published products from Supabase for the public storefront. */
  async getStorefrontProducts(): Promise<any[]> {
    if (this.isDemoMode || !this.client) {
      console.log('[Storefront] Fetched product count: 0 (no Supabase connection)');
      console.log('[Storefront] Fetched image count: 0');
      return [];
    }

    const { data, error } = await this.client
      .from('products')
      .select(`
        *,
        brands (name, logo_url),
        product_features (feature_text),
        product_tags (tag),
        product_collections (collection_name),
        product_variants (
          id,
          color,
          composite_hash,
          product_images (url, is_primary, sort_order),
          variant_sizes (id, size_number, stock)
        )
      `)
      .eq('status', 'published');

    if (error) {
      console.error('[Storefront] Supabase product fetch failed:', error);
      throw new Error(`Storefront catalog fetch failed: ${error.message}`);
    }

    const products = this.dedupeStorefrontProducts((data || []).map(p => this.mapProductRow(p)));
    const imageCount = this.countProductImages(products);

    console.log(`[Storefront] Fetched product count: ${products.length}`);
    console.log(`[Storefront] Fetched image count: ${imageCount}`);
    if (products.length === 0) {
      console.warn('[Storefront] Supabase returned 0 published products. Check products.status = published.');
    }

    return products;
  }

  async getDefaultBranchId(): Promise<string> {
    if (this.cachedBranchId) {
      return this.cachedBranchId;
    }

    if (this.isDemoMode || !this.client) {
      this.cachedBranchId = '00000000-0000-0000-0000-000000000001';
      return this.cachedBranchId;
    }

    try {
      const { data, error } = await this.client
        .from('branches')
        .select('id')
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        this.cachedBranchId = data[0].id;
        return this.cachedBranchId as string;
      }

      // If no branch exists, insert a default one
      const newBranch = {
        id: crypto.randomUUID(),
        name: 'Vijayasri Footwear',
        location: 'Coimbatore'
      };

      const { data: inserted, error: insertErr } = await this.client
        .from('branches')
        .insert(newBranch)
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      this.cachedBranchId = inserted.id;
      return this.cachedBranchId as string;
    } catch (e) {
      console.error('[Supabase Error] Failed to retrieve or create default branch ID, upserting seed branch:', e);
      try {
        const seedBranch = {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Gandhipuram Showroom',
          location: 'Coimbatore, Tamil Nadu',
        };
        const { data: upserted, error: upsertErr } = await this.client
          .from('branches')
          .upsert(seedBranch, { onConflict: 'id' })
          .select('id')
          .single();
        if (!upsertErr && upserted?.id) {
          logImporterBranchResolution(upserted.id, false, true);
          this.cachedBranchId = upserted.id;
          return upserted.id;
        }
      } catch (upsertFail) {
        console.error('[Supabase Error] Seed branch upsert failed:', upsertFail);
      }
      this.cachedBranchId = '00000000-0000-0000-0000-000000000001';
      return this.cachedBranchId;
    }
  }

  /**
   * Resolve a brand name from Gemini to a valid brands.id UUID.
   * Lookup: LOWER(name) = LOWER(brandName). Create if missing. Unknown → Generic.
   * Accepts raw Gemini brand/model and normalizes before lookup.
   */
  async resolveBrandIdForImport(
    detectedBrand: string | null | undefined,
    detectedModel?: string | null,
    detectedName?: string | null
  ): Promise<{ brandId: string; brand: string; model: string; name: string }> {
    const { brand, model, name, rawBrand } = normalizeBrandAndModel(
      detectedBrand,
      detectedModel,
      detectedName
    );
    const brandName = brand;
    const slug = buildBrandSlug(brandName);

    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      const brands = await this.mockDb.getBrands();
      let existing = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
      let created = false;
      if (!existing) {
        created = true;
        existing = {
          id: crypto.randomUUID(),
          name: brandName,
          slug,
          logo_url: null,
          created_at: new Date().toISOString(),
        };
        await this.mockDb.saveBrand(existing);
      }
      logImporterBrandResolution(rawBrand, brandName, model, existing.id, !created, created);
      assertUuid(existing.id, 'brand_id');
      return { brandId: existing.id, brand: brandName, model, name };
    }

    let found = false;
    let created = false;
    let brandId: string;

    const { data: existing, error: lookupErr } = await this.client
      .from('brands')
      .select('id')
      .ilike('name', brandName)
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      throw new Error(`Brand lookup failed: ${lookupErr.message}`);
    }

    if (existing?.id) {
      found = true;
      brandId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await this.client
        .from('brands')
        .insert({ name: brandName, slug, logo_url: null })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          const { data: retry, error: retryErr } = await this.client
            .from('brands')
            .select('id')
            .ilike('name', brandName)
            .limit(1)
            .maybeSingle();
          if (retryErr) throw new Error(`Brand retry lookup failed: ${retryErr.message}`);
          if (!retry?.id) throw new Error(`Brand insert conflict but no row found for "${brandName}"`);
          found = true;
          brandId = retry.id;
        } else {
          throw new Error(`Brand create failed: ${insertErr.message}`);
        }
      } else if (!inserted?.id) {
        throw new Error(`Brand create returned no id for "${brandName}"`);
      } else {
        created = true;
        brandId = inserted.id;
      }
    }

    logImporterBrandResolution(rawBrand, brandName, model, brandId!, found, created);
    assertUuid(brandId!, 'brand_id');
    return { brandId: brandId!, brand: brandName, model, name };
  }

  get mode(): 'demo' | 'supabase' {
    return this.isDemoMode ? 'demo' : 'supabase';
  }

  // --- BRANCHES ---
  async getBranches(): Promise<Branch[]> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getBranches();
    }
    const { data, error } = await this.client
      .from('branches')
      .select('*');
    if (error) throw error;
    return data || [];
  }

  // --- BRANDS ---
  async getBrands(): Promise<Brand[]> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getBrands();
    }
    const { data, error } = await this.client
      .from('brands')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async saveBrand(brand: Brand): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.saveBrand(brand);
    }
    const { error } = await this.client
      .from('brands')
      .upsert(brand);
    if (error) throw error;
  }

  // --- PRODUCTS & VARIANTS ---
  async getProducts(): Promise<any[]> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      const rawProducts = await this.mockDb.getProducts();
      // Enrich with variants and primary images
      const enriched = await Promise.all(
        rawProducts.map(p => this.mockDb.getProduct(p.id))
      );
      return enriched.filter(Boolean);
    }

    const { data, error } = await this.client
      .from('products')
      .select(`
        *,
        brands (name, logo_url),
        product_features (feature_text),
        product_tags (tag),
        product_collections (collection_name),
        product_variants (
          id,
          color,
          composite_hash,
          product_images (url, is_primary, sort_order),
          variant_sizes (id, size_number, stock)
        )
      `);
    
    if (error) throw error;
    
    return (data || []).map(p => this.mapProductRow(p));
  }

  async getProduct(id: string): Promise<any | null> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getProduct(id);
    }
    const { data, error } = await this.client
      .from('products')
      .select(`
        *,
        brands (name, logo_url),
        product_features (feature_text),
        product_tags (tag),
        product_collections (collection_name),
        product_variants (
          id,
          color,
          composite_hash,
          product_images (url, is_primary, sort_order),
          variant_sizes (id, size_number, stock)
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) return null;
    if (!data) return null;

    return this.mapProductRow(data);
  }

  /** Find existing product by variant image hash — prevents duplicate imports. */
  async findProductByCompositeHash(compositeHash: string): Promise<string | null> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.findProductByCompositeHash(compositeHash);
    }
    const { data, error } = await this.client
      .from('product_variants')
      .select('product_id')
      .eq('composite_hash', compositeHash)
      .limit(1)
      .maybeSingle();
    if (error || !data?.product_id) return null;
    return data.product_id as string;
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
    }>
  ): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.saveProduct(product, features, tags, collections, variants);
    }

    if (variants.length > 0 && variants[0].compositeHash) {
      const existingId = await this.findProductByCompositeHash(variants[0].compositeHash);
      if (existingId && existingId !== product.id) {
        console.warn(`[DB] Merging import into existing product ${existingId} (duplicate hash)`);
        product.id = existingId;
      }
    }

    // 1. Save product
    try {
      const { error: pErr } = await this.client.from('products').upsert(product);
      if (pErr) throw pErr;
    } catch (err: any) {
      console.error('[Supabase Error] Product insert failed:', err);
      throw new Error(`Product insert failed: ${err.message || err.details || JSON.stringify(err)}`);
    }

    // 2. Features
    try {
      await this.client.from('product_features').delete().eq('product_id', product.id);
      if (features.length > 0) {
        const { error: fErr } = await this.client.from('product_features').insert(
          features.map(f => ({ product_id: product.id, feature_text: f }))
        );
        if (fErr) throw fErr;
      }
    } catch (err: any) {
      console.error('[Supabase Error] Product features insert failed:', err);
      throw new Error(`Product features insert failed: ${err.message || err.details || JSON.stringify(err)}`);
    }

    // 3. Tags
    try {
      await this.client.from('product_tags').delete().eq('product_id', product.id);
      if (tags.length > 0) {
        const { error: tErr } = await this.client.from('product_tags').insert(
          tags.map(t => ({ product_id: product.id, tag: t }))
        );
        if (tErr) throw tErr;
      }
    } catch (err: any) {
      console.error('[Supabase Error] Product tags insert failed:', err);
      throw new Error(`Product tags insert failed: ${err.message || err.details || JSON.stringify(err)}`);
    }

    // 4. Collections
    try {
      await this.client.from('product_collections').delete().eq('product_id', product.id);
      if (collections.length > 0) {
        const { error: cErr } = await this.client.from('product_collections').insert(
          collections.map(c => ({ product_id: product.id, collection_name: c }))
        );
        if (cErr) throw cErr;
      }
    } catch (err: any) {
      console.error('[Supabase Error] Product collections insert failed:', err);
      throw new Error(`Product collections insert failed: ${err.message || err.details || JSON.stringify(err)}`);
    }

    // 5. Variants, Images, Sizes
    // First, query existing variants to delete their children
    let oldVariants;
    try {
      const { data, error } = await this.client
        .from('product_variants')
        .select('id')
        .eq('product_id', product.id);
      if (error) throw error;
      oldVariants = data;
    } catch (err: any) {
      console.error('[Supabase Error] Querying old variants failed:', err);
      throw new Error(`Querying old variants failed: ${err.message || err.details || JSON.stringify(err)}`);
    }
    
    if (oldVariants && oldVariants.length > 0) {
      const ids = oldVariants.map(v => v.id);
      try {
        await this.client.from('product_images').delete().in('variant_id', ids);
        await this.client.from('variant_sizes').delete().in('variant_id', ids);
        await this.client.from('product_variants').delete().in('id', ids);
      } catch (err: any) {
        console.error('[Supabase Error] Deleting old variants metadata failed:', err);
        throw new Error(`Deleting old variants metadata failed: ${err.message || err.details || JSON.stringify(err)}`);
      }
    }

    // Insert new ones
    for (const v of variants) {
      let variantId: string;
      try {
        const { data: vRecord, error: vErr } = await this.client
          .from('product_variants')
          .insert({
            product_id: product.id,
            color: v.color,
            composite_hash: v.compositeHash
          })
          .select()
          .single();
        if (vErr) throw vErr;
        variantId = vRecord.id;
      } catch (err: any) {
        console.error('[Supabase Error] Variant insert failed:', err);
        throw new Error(`Variant insert failed: ${err.message || err.details || JSON.stringify(err)}`);
      }

      // Images
      if (v.images.length > 0) {
        try {
          const { error: imgErr } = await this.client.from('product_images').insert(
            v.images.map(img => ({
              variant_id: variantId,
              url: img.url,
              is_primary: img.is_primary,
              sort_order: img.sort_order
            }))
          );
          if (imgErr) throw imgErr;
        } catch (err: any) {
          console.error('[Supabase Error] Image insert failed:', err);
          throw new Error(`Image insert failed: ${err.message || err.details || JSON.stringify(err)}`);
        }
      }

      // Sizes
      for (const s of v.sizes) {
        let szRecord: any;
        try {
          const { data, error: szErr } = await this.client
            .from('variant_sizes')
            .insert({
              variant_id: variantId,
              size_number: s.size_number,
              stock: s.stock
            })
            .select()
            .single();
          if (szErr) throw szErr;
          szRecord = data;
        } catch (err: any) {
          console.error('[Supabase Error] Variant sizes insert failed:', err);
          throw new Error(`Variant sizes insert failed: ${err.message || err.details || JSON.stringify(err)}`);
        }

        // Inventory Transaction (Initial purchase log)
        try {
          const { error: txErr } = await this.client.from('inventory_transactions').insert({
            variant_size_id: szRecord.id,
            transaction_type: 'PURCHASE',
            quantity: s.stock
          });
          if (txErr) throw txErr;
        } catch (err: any) {
          console.error('[Supabase Error] Inventory transaction insert failed:', err);
          throw new Error(`Inventory transaction insert failed: ${err.message || err.details || JSON.stringify(err)}`);
        }
      }
    }
  }

  async deleteProduct(id: string): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.deleteProduct(id);
    }
    const { error } = await this.client
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // --- INVENTORY ADJUSTMENTS ---
  async adjustInventory(variantSizeId: string, type: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT', quantity: number): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.adjustInventory(variantSizeId, type, quantity);
    }

    // Fetch current size details
    const { data: szRecord, error: szErr } = await this.client
      .from('variant_sizes')
      .select('stock')
      .eq('id', variantSizeId)
      .single();
    if (szErr) throw szErr;

    let delta = quantity;
    if (type === 'SALE') {
      delta = -quantity;
    }

    const newStock = Math.max(0, szRecord.stock + delta);
    
    // Update stock
    const { error: stockErr } = await this.client
      .from('variant_sizes')
      .update({ stock: newStock })
      .eq('id', variantSizeId);
    if (stockErr) throw stockErr;

    // Log transaction ledger
    const { error: txErr } = await this.client
      .from('inventory_transactions')
      .insert({
        variant_size_id: variantSizeId,
        transaction_type: type,
        quantity
      });
    if (txErr) throw txErr;
  }

  // --- CRM LEADS ---
  async getLeads(): Promise<Lead[]> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getLeads();
    }
    const { data, error } = await this.client
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createLead(lead: Lead): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.createLead(lead);
    }
    const { error } = await this.client
      .from('leads')
      .insert(lead);
    if (error) throw error;
  }

  async updateLeadStatus(id: string, status: 'new' | 'contacted' | 'reserved' | 'sold' | 'closed'): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.updateLeadStatus(id, status);
    }
    const { error } = await this.client
      .from('leads')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  }

  // --- ANALYTICS EVENTS ---
  async logEvent(event: AnalyticsEvent): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.logEvent(event);
    }
    const { error } = await this.client
      .from('analytics_events')
      .insert(event);
    if (error) throw error;
  }

  async getDailySummaries(): Promise<DailyAnalyticsSummary[]> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getDailySummaries();
    }
    const { data, error } = await this.client
      .from('daily_analytics_summary')
      .select('*')
      .order('summary_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // --- HOMEPAGE LAYOUTS ---
  async getHomepageLayout(branchId: string): Promise<HomepageLayout> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getHomepageLayout(branchId);
    }
    const { data, error } = await this.client
      .from('homepage_layouts')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) {
      // Create default
      const defaultLayout = {
        branch_id: branchId,
        layout_json: {
          sections: ['hero', 'newArrivals', 'trending', 'categories', 'manual_collections']
        },
        festival_mode: 'normal'
      };
      const { data: record, error: cErr } = await this.client
        .from('homepage_layouts')
        .insert(defaultLayout)
        .select()
        .single();
      if (cErr) throw cErr;
      return record;
    }
    
    return data;
  }

  async saveHomepageLayout(layout: HomepageLayout): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.saveHomepageLayout(layout);
    }
    const { error } = await this.client
      .from('homepage_layouts')
      .upsert(layout);
    if (error) throw error;
  }

  // --- ACTIVITY LOGS ---
  async getLogs(): Promise<any[]> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.getLogs();
    }
    const { data, error } = await this.client
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async logActivity(adminName: string, action: string, details: string): Promise<void> {
    if (this.isDemoMode || !this.client) {
      await this.ensureReady();
      return this.mockDb.logActivity(adminName, action, details);
    }
    const { error } = await this.client
      .from('activity_logs')
      .insert({
        admin_name: adminName,
        action,
        details
      });
    if (error) throw error;
  }
}

export const db = new DatabaseService();
export default db;
