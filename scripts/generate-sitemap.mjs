/**
 * generate-sitemap.mjs
 * Build-time sitemap generator for VijayaSri Footwear.
 * Fetches all published products from Supabase and writes sitemap.xml.
 * Run: node scripts/generate-sitemap.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Manual .env reading (no dotenv dependency needed)
function loadEnv(envPath) {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(resolve(__dirname, '../.env'));
loadEnv(resolve(__dirname, '../.env.local'));

const BASE_URL = 'https://vijayasri-footwear.pages.dev';
const OUTPUT_PATH = resolve(__dirname, '../apps/storefront/public/sitemap.xml');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const STATIC_URLS = [
  { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
  { loc: `${BASE_URL}/?category=slippers`, priority: '0.9', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?category=sandals`, priority: '0.9', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?category=formal`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?category=sports`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?category=crocs`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?brand=Walkaroo`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?brand=Paragon`, priority: '0.8', changefreq: 'weekly' },
  { loc: `${BASE_URL}/?brand=VKC`, priority: '0.8', changefreq: 'weekly' },
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemap(urls) {
  const items = urls.map(u => `
  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.image ? `
    <image:image>
      <image:loc>${escapeXml(u.image)}</image:loc>
      <image:title>${escapeXml(u.imageTitle || '')}</image:title>
    </image:image>` : ''}
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${items}
</urlset>`;
}

async function main() {
  const allUrls = [...STATIC_URLS];

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      console.log('📡 Fetching products from Supabase...');
      const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      const { data: products, error } = await client
        .from('products')
        .select(`
          id, name, category, updated_at,
          product_variants(
            product_images(url, is_primary, sort_order)
          )
        `)
        .eq('status', 'published')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const productUrls = (products || []).map(p => {
        const variants = p.product_variants || [];
        const images = variants.flatMap(v => v.product_images || []);
        const primaryImg = images.find(i => i.is_primary) || images[0];
        const imgUrl = primaryImg?.url;
        const safeImg = imgUrl && !imgUrl.startsWith('data:') ? imgUrl : null;

        return {
          loc: `${BASE_URL}/?p=${p.id}`,
          priority: '0.7',
          changefreq: 'weekly',
          ...(safeImg ? { image: safeImg, imageTitle: p.name } : {})
        };
      });

      allUrls.push(...productUrls);
      console.log(`✅ Added ${productUrls.length} product URLs to sitemap.`);
    } catch (err) {
      console.warn('⚠️  Supabase fetch failed, generating static sitemap only.', err.message);
    }
  } else {
    console.warn('⚠️  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set. Generating static sitemap only.');
  }

  writeFileSync(OUTPUT_PATH, buildSitemap(allUrls), 'utf-8');
  console.log(`🗺️  Sitemap written to ${OUTPUT_PATH} (${allUrls.length} URLs)`);
}

main();
