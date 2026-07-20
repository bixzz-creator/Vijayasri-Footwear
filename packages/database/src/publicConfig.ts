/** Public Supabase config for the storefront (anon key is safe to expose client-side). */
export interface PublicStorefrontConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  presentationSettings?: {
    enableSmartPricing?: boolean;
    enableDiscountGenerator?: boolean;
  };
}

const STORAGE_KEY = 'vijayasri_storefront_public_config';

export function savePublicStorefrontConfig(config: PublicStorefrontConfig): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadPublicStorefrontConfig(): PublicStorefrontConfig | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicStorefrontConfig;
    if (parsed.supabaseUrl && parsed.supabaseAnonKey) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearPublicStorefrontConfig(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
