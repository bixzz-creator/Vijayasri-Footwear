import React from "react";
import { BASE_URL, SITE_NAME } from "../hooks/useSEO";

interface StructuredDataProps {
  product?: any | null;
  category?: string;
  products?: any[];
}

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data, null, 0) }}
    />
  );
}

export function StructuredData({ product, category, products = [] }: StructuredDataProps) {
  const org = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "Store"],
    "@id": `${BASE_URL}/#organization`,
    "name": SITE_NAME,
    "url": BASE_URL,
    "logo": `${BASE_URL}/logo.png`,
    "image": `${BASE_URL}/shop-front.jpg`,
    "description": "Premium footwear showroom in Ayyempettai, Thanjavur offering slippers, sandals, formal shoes and sports footwear from top brands.",
    "telephone": "+918300029513",
    "priceRange": "\u20B9150 - \u20B91500",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Ayyempettai",
      "addressLocality": "Thanjavur",
      "addressRegion": "Tamil Nadu",
      "postalCode": "613501",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 10.8955943,
      "longitude": 79.18823
    },
    "hasMap": "https://www.google.com/maps/place/VIJAYA+SRI+FOOTWEARS/@10.8955943,79.18823,17z",
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "opens": "09:00",
        "closes": "21:00"
      }
    ],
    "sameAs": [
      `https://wa.me/918300029513`
    ]
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    "name": SITE_NAME,
    "url": BASE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BASE_URL}/?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  const breadcrumbs: any = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": BASE_URL
      }
    ]
  };

  if (category && category !== "All") {
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      "position": 2,
      "name": category.charAt(0).toUpperCase() + category.slice(1),
      "item": `${BASE_URL}/?category=${encodeURIComponent(category.toLowerCase())}`
    });
  }

  if (product) {
    const label = category && category !== "All"
      ? category.charAt(0).toUpperCase() + category.slice(1)
      : product.category || "Footwear";
    breadcrumbs.itemListElement.push(
      { "@type": "ListItem", "position": 2, "name": label, "item": `${BASE_URL}/?category=${encodeURIComponent((product.category || "footwear").toLowerCase())}` },
      { "@type": "ListItem", "position": 3, "name": product.name, "item": `${BASE_URL}/?p=${product.id}` }
    );
  }

  return (
    <>
      <JsonLd data={org} />
      <JsonLd data={website} />
      <JsonLd data={breadcrumbs} />
      {product && <ProductSchema product={product} />}
      {!product && category && category !== "All" && products.length > 0 && (
        <CategorySchema category={category} products={products} />
      )}
    </>
  );
}

function ProductSchema({ product }: { product: any }) {
  const variant = product.variants?.[0];
  const imgUrl = variant?.images?.find((i: any) => i.is_primary)?.url
    || variant?.images?.[0]?.url
    || `${BASE_URL}/logo.png`;
  const safeImg = imgUrl.startsWith("data:") ? `${BASE_URL}/logo.png` : imgUrl;
  const sizes = variant?.sizes || [];
  const inStock = sizes.some((s: any) => s.stock > 0);

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE_URL}/?p=${product.id}`,
    "name": product.name,
    "description": product.description || `${product.name} by ${product.brandName || "VijayaSri Footwear"}`,
    "image": [safeImg],
    "sku": product.sku,
    "mpn": product.sku,
    "brand": {
      "@type": "Brand",
      "name": product.brandName || SITE_NAME
    },
    "category": product.category || "Footwear",
    "material": product.material || undefined,
    "color": variant?.color || undefined,
    "offers": {
      "@type": "Offer",
      "url": `${BASE_URL}/?p=${product.id}`,
      "priceCurrency": "INR",
      "price": String(product.offer_price),
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      "availability": inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": SITE_NAME
      }
    }
  };

  if (product.mrp && product.mrp > product.offer_price) {
    schema.offers.highPrice = String(product.mrp);
    schema.offers.lowPrice = String(product.offer_price);
  }

  return <JsonLd data={schema} />;
}

function CategorySchema({ category, products }: { category: string; products: any[] }) {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${label} — ${SITE_NAME}`,
    "url": `${BASE_URL}/?category=${encodeURIComponent(category.toLowerCase())}`,
    "numberOfItems": products.length,
    "itemListElement": products.slice(0, 20).map((p, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "url": `${BASE_URL}/?p=${p.id}`,
      "name": p.name
    }))
  };
  return <JsonLd data={schema} />;
}
