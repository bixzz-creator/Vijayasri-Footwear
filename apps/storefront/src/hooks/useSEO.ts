/**
 * useSEO — Dynamic SEO hook for VijayaSri Footwear storefront.
 * Updates document.title, canonical, and all meta/OG tags reactively.
 */
import { useEffect } from "react";

export const SITE_NAME = "VijayaSri Footwear";
export const BASE_URL = "https://vijayasri-footwear.pages.dev";
export const DEFAULT_TITLE = `${SITE_NAME} — Slippers, Sandals & Shoes | Ayyempettai, Thanjavur`;
export const DEFAULT_DESC =
  "Browse slippers, sandals, formal shoes and sports footwear from top brands like Walkaroo, Paragon, VKC & more. Visit our Ayyempettai, Thanjavur showroom or enquire via WhatsApp.";
export const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;

function setMeta(name: string, content: string, property = false) {
  const attr = property ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function normalizeCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url, BASE_URL);
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const params = new URLSearchParams(parsed.search);
    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', 'ref'];
    trackingKeys.forEach(k => params.delete(k));
    const queryString = params.toString();
    return `${parsed.origin}${pathname}${queryString ? `?${queryString}` : ''}`;
  } catch {
    return url;
  }
}

function setCanonical(rawUrl: string) {
  const url = normalizeCanonicalUrl(rawUrl);
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setRobots(noindex: boolean) {
  let el = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "robots");
    document.head.appendChild(el);
  }
  el.setAttribute("content", noindex ? "noindex,nofollow" : "index,follow");
}

export interface SEOOptions {
  product?: any | null;
  category?: string;
  brand?: string;
  searchQuery?: string;
  is404?: boolean;
}

export function useSEO({ product, category, brand, searchQuery, is404 }: SEOOptions = {}) {
  useEffect(() => {
    // ── 404 page ─────────────────────────────────────────────────────────────
    if (is404) {
      document.title = `Page Not Found — ${SITE_NAME}`;
      setMeta("description", "The page you are looking for does not exist.");
      setCanonical(BASE_URL + "/");
      setRobots(true);
      return;
    }

    setRobots(false);

    // ── Product detail ────────────────────────────────────────────────────────
    if (product) {
      const variant = product.variants?.[0];
      const color = variant?.color || "";
      const imgUrl =
        variant?.images?.find((i: any) => i.is_primary)?.url ||
        variant?.images?.[0]?.url ||
        DEFAULT_IMAGE;
      const safeImg = imgUrl.startsWith("data:") ? DEFAULT_IMAGE : imgUrl;

      const title = `${product.name}${color ? ` — ${color}` : ""} | ${product.brandName || ""} | ${SITE_NAME}`;
      const desc =
        product.description?.slice(0, 155) ||
        `Buy ${product.name} by ${product.brandName || "top brand"}. ` +
        `${color ? `Available in ${color}. ` : ""}` +
        `MRP \u20B9${product.mrp}, Offer Price \u20B9${product.offer_price}. Enquire via WhatsApp.`;
      const canonicalUrl = `${BASE_URL}/?p=${product.id}`;

      document.title = title;
      setMeta("description", desc);
      setCanonical(canonicalUrl);
      setMeta("og:type", "product", true);
      setMeta("og:url", canonicalUrl, true);
      setMeta("og:title", title, true);
      setMeta("og:description", desc, true);
      setMeta("og:image", safeImg, true);
      setMeta("og:image:alt", `${product.name} by ${product.brandName || ""}`, true);
      setMeta("og:locale", "en_IN", true);
      setMeta("og:site_name", SITE_NAME, true);
      setMeta("product:price:amount", String(product.offer_price || ""), true);
      setMeta("product:price:currency", "INR", true);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", title);
      setMeta("twitter:description", desc);
      setMeta("twitter:image", safeImg);
      return;
    }

    // ── Category / brand filtered view ────────────────────────────────────────
    if (category && category !== "All") {
      const label = category.charAt(0).toUpperCase() + category.slice(1);
      const brandSuffix = brand && brand !== "All" ? ` | ${brand}` : "";
      const title = `${label}${brandSuffix} — ${SITE_NAME}`;
      const desc = `Shop ${label.toLowerCase()} footwear${brandSuffix ? ` from ${brand}` : ""} at VijayaSri Footwear, Ayyempettai, Thanjavur. Great prices, top brands.`;
      const canonicalUrl = `${BASE_URL}/?category=${encodeURIComponent(category.toLowerCase())}`;

      document.title = title;
      setMeta("description", desc);
      setCanonical(canonicalUrl);
      setMeta("og:type", "website", true);
      setMeta("og:url", canonicalUrl, true);
      setMeta("og:title", title, true);
      setMeta("og:description", desc, true);
      setMeta("og:image", DEFAULT_IMAGE, true);
      setMeta("og:site_name", SITE_NAME, true);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", title);
      setMeta("twitter:description", desc);
      return;
    }

    // ── Search results ─────────────────────────────────────────────────────────
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      document.title = `Search: "${q}" — ${SITE_NAME}`;
      setMeta("description", `Find "${q}" footwear at VijayaSri Footwear, Ayyempettai, Thanjavur.`);
      setCanonical(BASE_URL + "/");
      setRobots(true); // don't index search result pages
      return;
    }

    // ── Home page (default) ───────────────────────────────────────────────────
    document.title = DEFAULT_TITLE;
    setMeta("description", DEFAULT_DESC);
    setCanonical(BASE_URL + "/");
    setMeta("og:type", "website", true);
    setMeta("og:url", BASE_URL + "/", true);
    setMeta("og:title", DEFAULT_TITLE, true);
    setMeta("og:description", DEFAULT_DESC, true);
    setMeta("og:image", DEFAULT_IMAGE, true);
    setMeta("og:locale", "en_IN", true);
    setMeta("og:site_name", SITE_NAME, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", DEFAULT_TITLE);
    setMeta("twitter:description", DEFAULT_DESC);
    setMeta("twitter:image", DEFAULT_IMAGE);
  }, [product, category, brand, searchQuery, is404]);
}
