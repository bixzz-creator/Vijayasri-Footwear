export interface Branch {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  slug: string;
  created_at: string;
}

export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export interface Product {
  id: string;
  branch_id: string;
  brand_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  gender: 'Men' | 'Women' | 'Kids' | 'Unisex';
  category: string;
  material: string;
  mrp: number;
  offer_price: number;
  description: string;
  status: ProductStatus;
  ai_prompt_version: string;
  ai_confidence_score: number;
  ai_analysis_details: {
    brandStatus: 'exact' | 'guessed' | 'absent';
    modelStatus: 'certain' | 'uncertain' | 'absent';
    categoryStatus: 'certain' | 'uncertain';
    materialStatus: 'certain' | 'uncertain';
  };
  created_at: string;
  updated_at: string;
}

export interface ProductFeature {
  id: string;
  product_id: string;
  feature_text: string;
}

export interface ProductTag {
  id: string;
  product_id: string;
  tag: string;
}

export interface ProductCollection {
  id: string;
  product_id: string;
  collection_name: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color: string;
  composite_hash: string;
  created_at: string;
}

export interface ProductImage {
  id: string;
  variant_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface VariantSize {
  id: string;
  variant_id: string;
  size_number: number;
  stock: number;
  created_at: string;
}

export type InventoryTransactionType = 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT';

export interface InventoryTransaction {
  id: string;
  variant_size_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  created_at: string;
}

export type LeadSource = 'WhatsApp' | 'Call' | 'Walk-in';
export type LeadStatus = 'new' | 'contacted' | 'reserved' | 'sold' | 'closed';

export interface Lead {
  id: string;
  customer_name: string | null;
  phone: string;
  interested_product_id: string | null;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
}

export type AnalyticsEventType =
  | 'view'
  | 'whatsapp_click'
  | 'phone_call'
  | 'search'
  | 'filter'
  | 'share'
  | 'gallery_open'
  | 'variant_change'
  | 'zoom'
  | 'qr_scan';

export interface AnalyticsEvent {
  id: string;
  product_id: string | null;
  event_type: AnalyticsEventType;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface DailyAnalyticsSummary {
  id: string;
  summary_date: string;
  views_count: number;
  whatsapp_clicks_count: number;
  calls_count: number;
  leads_count: number;
}

export interface HomepageLayout {
  id: string;
  branch_id: string;
  layout_json: {
    sections: string[];
  };
  festival_mode: 'normal' | 'diwali' | 'pongal' | 'christmas' | 'ramzan' | 'newyear';
  updated_at: string;
}

// Client Processing Queue Types
export type ProcessStatus = 'pending' | 'preprocessing' | 'analyzing' | 'completed' | 'failed' | 'skipped';

/** Import pipeline: AI vision (Gemini) or catalog filename mode (no API key). */
export type ImportMode = 'ai' | 'catalog';

export interface QueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  file: File;
  /** Parent folder name when selected via directory picker — used for brand hints. */
  folderHint?: string;
  status: ProcessStatus;
  progress: number;
  error?: string;
  // Extracted data (pre-publishing stage)
  extractedData?: {
    name: string;
    brand: string;
    model: string;
    gender: 'Men' | 'Women' | 'Kids' | 'Unisex';
    category: string;
    material: string;
    mrp: number;
    offer_price: number;
    description: string;
    features: string[];
    tags: string[];
    collections: string[];
    color: string;
    sizes: number[];
    aiConfidence: number;
    aiAnalysisDetails: {
      brandStatus: 'exact' | 'guessed' | 'absent';
      modelStatus: 'certain' | 'uncertain' | 'absent';
      categoryStatus: 'certain' | 'uncertain';
      materialStatus: 'certain' | 'uncertain';
    };
  };
  // Image metadata
  processedImageUrl?: string;
  thumbnailUrl?: string;
  compositeHash?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  /** Set after auto-publish during batch processing — prevents duplicate inserts */
  publishedProductId?: string;
  stage?: string;
}
