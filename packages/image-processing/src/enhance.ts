import type { BackgroundTheme } from '@vijayasri/shared';

export interface ColorPalette {
  dominant: string;
  secondary: string;
  accent: string;
}

export interface EnhancedImageResult {
  originalBase64: string;
  enhancedBase64: string;
  thumbnailBase64: string;
  isCatalogBackground: boolean;
  colorPalette: ColorPalette;
  backgroundTheme: BackgroundTheme;
  seoImageAlt?: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function samplePixel(data: Uint8ClampedArray, width: number, x: number, y: number): Rgb {
  const idx = (y * width + x) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

/** Detect manufacturer catalog banners (yellow/orange/red/blue promo backgrounds). */
export function detectCatalogBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  const samples: Rgb[] = [];
  const points: [number, number][] = [];
  const margin = Math.max(4, Math.floor(Math.min(width, height) * 0.04));

  for (let x = margin; x < width - margin; x += Math.floor(width / 12)) {
    points.push([x, margin], [x, height - margin]);
  }
  for (let y = margin; y < height - margin; y += Math.floor(height / 12)) {
    points.push([margin, y], [width - margin, y]);
  }

  let saturatedPromo = 0;
  for (const [x, y] of points) {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    samples.push({ r, g, b });
    const { h, s, l } = rgbToHsl(r, g, b);
    const isPromoHue =
      (h >= 15 && h <= 75 && s > 35) ||
      (h >= 0 && h <= 20 && s > 30) ||
      (h >= 200 && h <= 260 && s > 25);
    const isBrightPromo = s > 40 && l > 45 && l < 92;
    if (isPromoHue && isBrightPromo) saturatedPromo++;
  }

  return saturatedPromo / Math.max(samples.length, 1) > 0.28;
}

/** Extract dominant footwear colors from non-background pixels. */
export function extractFootwearColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgColor: Rgb
): ColorPalette {
  const buckets = new Map<string, { rgb: Rgb; count: number }>();

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3] ?? 255;
      if (a < 20) continue;

      const pixel: Rgb = { r, g, b };
      if (colorDistance(pixel, bgColor) < 42) continue;
      if (colorDistance(pixel, { r: 255, g: 255, b: 255 }) < 18) continue;

      const { s, l } = rgbToHsl(r, g, b);
      if (s < 8 && l > 88) continue;

      const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
      const existing = buckets.get(key);
      if (existing) existing.count++;
      else buckets.set(key, { rgb: pixel, count: 1 });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const dominant = sorted[0]?.rgb ?? { r: 60, g: 60, b: 60 };
  const secondary = sorted[1]?.rgb ?? dominant;
  const accent = sorted[2]?.rgb ?? secondary;

  return {
    dominant: rgbToHex(dominant.r, dominant.g, dominant.b),
    secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
    accent: rgbToHex(accent.r, accent.g, accent.b),
  };
}

/** Map footwear color → premium background theme (never saturated yellow/red). */
export function selectBackgroundTheme(palette: ColorPalette): BackgroundTheme {
  const { r, g, b } = hexToRgb(palette.dominant);
  const { h, s, l } = rgbToHsl(r, g, b);

  if (l > 78 && s < 18) return 'soft-gray';
  if (l < 28) return 'warm-gray';
  if (h >= 20 && h <= 45 && s > 15) return 'warm-ivory';
  if (h >= 330 || h <= 15) {
    if (s > 25 && l > 55) return 'blush';
    return l < 40 ? 'warm-gray' : 'stone-white';
  }
  if (h >= 200 && h <= 260) return 'ice-blue';
  if (h >= 90 && h <= 160) return 'mint-white';
  if (h >= 45 && h <= 90) return 'light-stone';
  if (s < 20) return l > 60 ? 'stone-white' : 'soft-gray';
  return 'pure-white';
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function getThemeColors(theme: BackgroundTheme): { top: string; bottom: string; shadow: string } {
  const map: Record<BackgroundTheme, { top: string; bottom: string; shadow: string }> = {
    'pure-white': { top: '#FFFFFF', bottom: '#FAFAFA', shadow: 'rgba(0,0,0,0.06)' },
    'warm-ivory': { top: '#FAF7F2', bottom: '#F3EDE4', shadow: 'rgba(120,90,50,0.08)' },
    'light-stone': { top: '#F5F3EF', bottom: '#EBE8E2', shadow: 'rgba(80,70,60,0.07)' },
    'soft-gradient': { top: '#F8F9FA', bottom: '#EEF1F4', shadow: 'rgba(0,0,0,0.05)' },
    'glass-card': { top: '#FFFFFF', bottom: '#F4F6F8', shadow: 'rgba(17,24,39,0.08)' },
    'warm-gray': { top: '#F0EEEC', bottom: '#E4E1DD', shadow: 'rgba(40,40,40,0.1)' },
    'soft-gray': { top: '#F3F4F6', bottom: '#E5E7EB', shadow: 'rgba(55,65,81,0.08)' },
    'stone-white': { top: '#FAFAF9', bottom: '#F5F5F4', shadow: 'rgba(0,0,0,0.05)' },
    blush: { top: '#FFF5F5', bottom: '#FCECEC', shadow: 'rgba(180,80,80,0.06)' },
    'ice-blue': { top: '#F5FAFF', bottom: '#EAF3FC', shadow: 'rgba(50,100,180,0.07)' },
    'mint-white': { top: '#F4FBF7', bottom: '#EAF6F0', shadow: 'rgba(40,120,80,0.06)' },
  };
  return map[theme];
}

function drawPremiumBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: BackgroundTheme
): void {
  const { top, bottom } = getThemeColors(theme);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (theme === 'glass-card' || theme === 'soft-gradient') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(w * 0.75, h * 0.25, w * 0.35, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Edge-connected flood fill — removes only background reachable from borders. Preserves white footwear. */
function markBackgroundPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  avgBg: Rgb,
  threshold: number,
  isCatalog: boolean
): Uint8Array {
  const isBg = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const queue: [number, number][] = [];

  for (let x = 0; x < width; x++) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push([0, y], [width - 1, y]);
  }

  const isBackgroundPixel = (r: number, g: number, b: number): boolean => {
    const pixel: Rgb = { r, g, b };
    const diff = colorDistance(pixel, avgBg);
    const { h: hue, s, l } = rgbToHsl(r, g, b);
    const isPromoBg =
      isCatalog &&
      s > 22 &&
      l > 28 &&
      ((hue >= 15 && hue <= 90) || (hue >= 160 && hue <= 265));
    return diff < threshold || isPromoBg;
  };

  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pi = idx * 4;
    const r = data[pi];
    const g = data[pi + 1];
    const b = data[pi + 2];

    if (!isBackgroundPixel(r, g, b)) continue;

    isBg[idx] = 1;
    if (x > 0) queue.push([x - 1, y]);
    if (x < width - 1) queue.push([x + 1, y]);
    if (y > 0) queue.push([x, y - 1]);
    if (y < height - 1) queue.push([x, y + 1]);
  }

  return isBg;
}

function countOpaquePixels(canvas: HTMLCanvasElement): number {
  const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 20) count++;
  }
  return count;
}

/** Aggressive catalog background removal preserving footwear silhouette. */
export function isolateFootwear(
  img: HTMLImageElement,
  isCatalog: boolean
): { canvas: HTMLCanvasElement; bgColor: Rgb } {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  const corners = [
    samplePixel(data, w, 5, 5),
    samplePixel(data, w, w - 5, 5),
    samplePixel(data, w, 5, h - 5),
    samplePixel(data, w, w - 5, h - 5),
  ];
  const avgBg: Rgb = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };

  const threshold = isCatalog ? 85 : 55;
  const bgMask = markBackgroundPixels(data, w, h, avgBg, threshold, isCatalog);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pi = idx * 4;
      if (bgMask[idx]) {
        data[pi + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, bgColor: avgBg };
}

/** Fallback: place full catalog photo on premium background (preserves entire product). */
export function composeFullImageOnPremiumBackground(
  img: HTMLImageElement,
  theme: BackgroundTheme,
  outputSize = 1200
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext('2d')!;
  drawPremiumBackground(ctx, outputSize, outputSize, theme);

  const scale = Math.min(
    (outputSize * 0.9) / img.naturalWidth,
    (outputSize * 0.9) / img.naturalHeight
  );
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (outputSize - dw) / 2;
  const dy = (outputSize - dh) / 2;

  ctx.shadowColor = getThemeColors(theme).shadow;
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.shadowColor = 'transparent';
  return out;
}

export function cropAndCenterProduct(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = sourceCanvas.getContext('2d')!;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w, maxX = 0, minY = h, maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return sourceCanvas;

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const targetSize = Math.max(cropW, cropH) * 1.2;
  const output = document.createElement('canvas');
  output.width = targetSize;
  output.height = targetSize;
  const outCtx = output.getContext('2d')!;
  outCtx.clearRect(0, 0, targetSize, targetSize);

  const dx = (targetSize - cropW) / 2;
  const dy = (targetSize - cropH) / 2;
  outCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, dx, dy, cropW, cropH);
  return output;
}

export function composePremiumProductImage(
  productCanvas: HTMLCanvasElement,
  theme: BackgroundTheme,
  outputSize = 1200
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext('2d')!;
  drawPremiumBackground(ctx, outputSize, outputSize, theme);

  const scale = Math.min(outputSize * 0.78 / productCanvas.width, outputSize * 0.78 / productCanvas.height);
  const dw = productCanvas.width * scale;
  const dh = productCanvas.height * scale;
  const dx = (outputSize - dw) / 2;
  const dy = (outputSize - dh) / 2;

  ctx.shadowColor = getThemeColors(theme).shadow;
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(productCanvas, dx, dy, dw, dh);
  ctx.shadowColor = 'transparent';

  return out;
}

export function canvasToWebP(canvas: HTMLCanvasElement, quality = 0.85): string {
  return canvas.toDataURL('image/webp', quality);
}

export function resizeCanvasToWebP(
  canvas: HTMLCanvasElement,
  maxDimension: number,
  quality: number
): string {
  const w = canvas.width;
  const h = canvas.height;
  let tw = w;
  let th = h;
  if (w > maxDimension || h > maxDimension) {
    if (w > h) {
      tw = maxDimension;
      th = Math.round((h * maxDimension) / w);
    } else {
      th = maxDimension;
      tw = Math.round((w * maxDimension) / h);
    }
  }
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, tw, th);
  return canvasToWebP(out, quality);
}

export function enhanceProductImage(
  img: HTMLImageElement,
  options: {
    enableEnhancement?: boolean;
    enableBackgroundReplacement?: boolean;
    productName?: string;
    brand?: string;
    color?: string;
  } = {}
): EnhancedImageResult {
  const enableEnhancement = options.enableEnhancement !== false;
  const enableBg = options.enableBackgroundReplacement !== false;

  const originalCanvas = document.createElement('canvas');
  originalCanvas.width = img.naturalWidth;
  originalCanvas.height = img.naturalHeight;
  originalCanvas.getContext('2d')!.drawImage(img, 0, 0);
  const originalBase64 = resizeCanvasToWebP(originalCanvas, 1200, 0.82);

  if (!enableEnhancement) {
    const thumb = resizeCanvasToWebP(originalCanvas, 150, 0.75);
    return {
      originalBase64,
      enhancedBase64: originalBase64,
      thumbnailBase64: thumb,
      isCatalogBackground: false,
      colorPalette: { dominant: '#333333', secondary: '#666666', accent: '#999999' },
      backgroundTheme: 'pure-white',
    };
  }

  const probe = originalCanvas.getContext('2d')!.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
  const isCatalog = detectCatalogBackground(probe.data, originalCanvas.width, originalCanvas.height);

  const { canvas: isolated, bgColor } = isolateFootwear(img, isCatalog);
  const cropped = cropAndCenterProduct(isolated);
  const totalPixels = cropped.width * cropped.height;
  const opaquePixels = countOpaquePixels(cropped);
  const productRatio = opaquePixels / Math.max(totalPixels, 1);

  let productCanvas: HTMLCanvasElement;
  let usedFallback = false;

  if (productRatio < 0.08) {
    console.warn('[Image Enhance] Isolation removed too much product — using full-image fallback');
    const theme = enableBg ? selectBackgroundTheme({ dominant: '#888888', secondary: '#aaaaaa', accent: '#cccccc' }) : 'pure-white';
    productCanvas = enableBg
      ? composeFullImageOnPremiumBackground(img, theme, 1200)
      : originalCanvas;
    usedFallback = true;
  } else {
    productCanvas = cropped;
  }

  const palette = usedFallback
    ? { dominant: '#666666', secondary: '#888888', accent: '#aaaaaa' }
    : extractFootwearColors(
        productCanvas.getContext('2d')!.getImageData(0, 0, productCanvas.width, productCanvas.height).data,
        productCanvas.width,
        productCanvas.height,
        bgColor
      );
  const theme = enableBg ? selectBackgroundTheme(palette) : 'pure-white';
  const composed = usedFallback
    ? productCanvas
    : enableBg
      ? composePremiumProductImage(productCanvas, theme, 1200)
      : productCanvas;

  const enhancedBase64 = resizeCanvasToWebP(composed, 1200, 0.85);
  const thumbnailBase64 = resizeCanvasToWebP(composed, 320, 0.8);

  const seoImageAlt =
    options.productName && options.brand
      ? `${options.brand} ${options.productName}${options.color ? ` in ${options.color}` : ''} — VijayaSri Footwear`
      : undefined;

  return {
    originalBase64,
    enhancedBase64,
    thumbnailBase64,
    isCatalogBackground: isCatalog,
    colorPalette: palette,
    backgroundTheme: theme,
    seoImageAlt,
  };
}
