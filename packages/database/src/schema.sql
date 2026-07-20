-- =========================================================
-- VIJAYASRI FOOTWEAR - SUPABASE DATABASE SCHEMA
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --- 1. BRANCHES ---
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 2. BRANDS ---
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 3. PRODUCTS ---
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(50) CHECK (gender IN ('Men', 'Women', 'Kids', 'Unisex')) NOT NULL,
    category VARCHAR(100) NOT NULL,
    material VARCHAR(100) NOT NULL,
    mrp NUMERIC(10, 2) NOT NULL,
    offer_price NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) CHECK (status IN ('draft', 'pending_review', 'published', 'archived')) DEFAULT 'draft' NOT NULL,
    ai_prompt_version VARCHAR(50),
    ai_confidence_score INTEGER,
    ai_analysis_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 4. PRODUCT FEATURES ---
CREATE TABLE IF NOT EXISTS product_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    feature_text TEXT NOT NULL
);

-- --- 5. PRODUCT TAGS ---
CREATE TABLE IF NOT EXISTS product_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    tag VARCHAR(100) NOT NULL
);

-- --- 6. PRODUCT COLLECTIONS ---
CREATE TABLE IF NOT EXISTS product_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    collection_name VARCHAR(100) NOT NULL
);

-- --- 7. PRODUCT VARIANTS ---
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    color VARCHAR(100) NOT NULL,
    composite_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 8. PRODUCT IMAGES ---
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL
);

-- --- 9. VARIANT SIZES (INVENTORY) ---
CREATE TABLE IF NOT EXISTS variant_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
    size_number INTEGER NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(variant_id, size_number)
);

-- --- 10. INVENTORY TRANSACTIONS ---
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_size_id UUID REFERENCES variant_sizes(id) ON DELETE CASCADE NOT NULL,
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT')) NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 11. CRM LEADS ---
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    interested_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    source VARCHAR(50) CHECK (source IN ('WhatsApp', 'Call', 'Walk-in')) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('new', 'contacted', 'reserved', 'sold', 'closed')) DEFAULT 'new' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 12. ANALYTICS EVENTS ---
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 13. DAILY ANALYTICS SUMMARY ---
CREATE TABLE IF NOT EXISTS daily_analytics_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summary_date DATE UNIQUE NOT NULL,
    views_count INTEGER DEFAULT 0 NOT NULL,
    whatsapp_clicks_count INTEGER DEFAULT 0 NOT NULL,
    calls_count INTEGER DEFAULT 0 NOT NULL,
    leads_count INTEGER DEFAULT 0 NOT NULL
);

-- --- 14. HOMEPAGE LAYOUTS ---
CREATE TABLE IF NOT EXISTS homepage_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    layout_json JSONB NOT NULL,
    festival_mode VARCHAR(50) CHECK (festival_mode IN ('normal', 'diwali', 'pongal', 'christmas', 'ramzan', 'newyear')) DEFAULT 'normal' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 15. ACTIVITY LOGS ---
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- 16. AI IMPORT SESSIONS & ITEMS ---
CREATE TABLE IF NOT EXISTS ai_import_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_images INTEGER NOT NULL,
    imported_count INTEGER DEFAULT 0 NOT NULL,
    duplicate_count INTEGER DEFAULT 0 NOT NULL,
    failed_count INTEGER DEFAULT 0 NOT NULL,
    elapsed_seconds INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'completed' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_import_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES ai_import_sessions(id) ON DELETE CASCADE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    confidence_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --- INDEXES FOR QUERY OPTIMIZATION ---
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_product_features_product ON product_features(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_product ON product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_collections_product ON product_collections(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant ON product_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_sizes_variant ON variant_sizes(variant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product ON analytics_events(product_id);

-- --- AUTOMATIC updated_at TRIGGERS ---
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_homepage_layouts_updated_at BEFORE UPDATE ON homepage_layouts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- --- SEED DATA ---
INSERT INTO branches (id, name, location)
VALUES ('00000000-0000-0000-0000-000000000001', 'Gandhipuram Showroom', 'Coimbatore, Tamil Nadu')
ON CONFLICT DO NOTHING;

-- --- ROW LEVEL SECURITY (RLS) & PUBLIC READ ACCESS ---
-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_import_items ENABLE ROW LEVEL SECURITY;

-- Allow public read access to catalog tables
CREATE POLICY public_read_branches ON branches FOR SELECT USING (true);
CREATE POLICY public_read_brands ON brands FOR SELECT USING (true);
CREATE POLICY public_read_products ON products FOR SELECT USING (true);
CREATE POLICY public_read_features ON product_features FOR SELECT USING (true);
CREATE POLICY public_read_tags ON product_tags FOR SELECT USING (true);
CREATE POLICY public_read_collections ON product_collections FOR SELECT USING (true);
CREATE POLICY public_read_variants ON product_variants FOR SELECT USING (true);
CREATE POLICY public_read_images ON product_images FOR SELECT USING (true);
CREATE POLICY public_read_sizes ON variant_sizes FOR SELECT USING (true);
CREATE POLICY public_read_layouts ON homepage_layouts FOR SELECT USING (true);
CREATE POLICY public_read_summaries ON daily_analytics_summary FOR SELECT USING (true);

-- Allow authenticated/unauthenticated write for CRM/Analytics
CREATE POLICY public_insert_leads ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY public_insert_events ON analytics_events FOR INSERT WITH CHECK (true);

-- Full control policies (allows bypass for catalog synchronization)
CREATE POLICY admin_all_branches ON branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_brands ON brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_products ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_features ON product_features FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_tags ON product_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_collections ON product_collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_variants ON product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_images ON product_images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_sizes ON variant_sizes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_transactions ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_leads ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_events ON analytics_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_summaries ON daily_analytics_summary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_layouts ON homepage_layouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_logs ON activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_sessions ON ai_import_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY admin_all_items ON ai_import_items FOR ALL USING (true) WITH CHECK (true);
