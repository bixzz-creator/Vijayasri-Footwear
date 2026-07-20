// Image processing utilities using browser HTML5 Canvas API

export * from './enhance';

/**
 * Stage interface for sequential processing pipeline.
 */
export type PipelineStage =
  | 'validate'
  | 'compress'
  | 'bg_cleanup'
  | 'crop_center'
  | 'thumbnail'
  | 'hash';

export interface ProcessedImageResult {
  originalBase64: string; // Compressed WebP base64
  thumbnailBase64: string; // 150x150 WebP thumbnail base64
  compositeHash: string; // 32-character hex dHash + averageHash
  isBlurry: boolean;
  blurScore: number;
}

/**
 * Helper to convert a File object to an HTMLImageElement.
 */
export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Corrupted image or unsupported file format.'));
    };
    img.src = url;
  });
}

/**
 * Computes an average hash (aHash) and difference hash (dHash) of an image.
 * Returns a 32-character hex string representing the 128-bit composite hash.
 */
export function computeCompositeHash(img: HTMLImageElement): string {
  // --- 1. Average Hash (8x8) ---
  const canvasA = document.createElement('canvas');
  canvasA.width = 8;
  canvasA.height = 8;
  const ctxA = canvasA.getContext('2d')!;
  ctxA.drawImage(img, 0, 0, 8, 8);
  const dataA = ctxA.getImageData(0, 0, 8, 8).data;
  
  // Grayscale and Average
  const grayA: number[] = [];
  let sum = 0;
  for (let i = 0; i < dataA.length; i += 4) {
    const g = Math.round(dataA[i] * 0.299 + dataA[i+1] * 0.587 + dataA[i+2] * 0.114);
    grayA.push(g);
    sum += g;
  }
  const avg = sum / 64;
  
  let aHashBin = '';
  for (const g of grayA) {
    aHashBin += g >= avg ? '1' : '0';
  }

  // --- 2. Difference Hash (9x8) ---
  const canvasD = document.createElement('canvas');
  canvasD.width = 9;
  canvasD.height = 8;
  const ctxD = canvasD.getContext('2d')!;
  ctxD.drawImage(img, 0, 0, 9, 8);
  const dataD = ctxD.getImageData(0, 0, 9, 8).data;
  
  const grayD: number[][] = [];
  for (let row = 0; row < 8; row++) {
    const rowPixels: number[] = [];
    for (const col of Array(9).keys()) {
      const idx = (row * 9 + col) * 4;
      const g = Math.round(dataD[idx] * 0.299 + dataD[idx+1] * 0.587 + dataD[idx+2] * 0.114);
      rowPixels.push(g);
    }
    grayD.push(rowPixels);
  }
  
  let dHashBin = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      dHashBin += grayD[row][col] > grayD[row][col + 1] ? '1' : '0';
    }
  }

  // Convert binary strings to hex
  const binToHex = (bin: string) => {
    let hex = '';
    for (let i = 0; i < bin.length; i += 4) {
      const nibble = bin.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }
    return hex;
  };

  return binToHex(aHashBin) + binToHex(dHashBin);
}

/**
 * Calculates the Hamming distance between two 32-character hex hashes.
 * Returns true if the similarity is >= 96.8% (Hamming distance <= 4 bits out of 128).
 */
export function checkDuplicateHash(hash1: string, hash2: string): boolean {
  if (hash1.length !== 32 || hash2.length !== 32) return false;
  let distance = 0;
  for (let i = 0; i < 32; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    let xor = val1 ^ val2;
    // Count set bits
    while (xor > 0) {
      if (xor & 1) distance++;
      xor >>= 1;
    }
  }
  return distance <= 4; // Max 4 bits mismatch means duplicates
}

/**
 * Detects if an image is blurry using Sobel gradient variance.
 * Score < 100 typically suggests out-of-focus or flat blurry contents.
 */
export function detectBlur(img: HTMLImageElement): { isBlurry: boolean; score: number } {
  const canvas = document.createElement('canvas');
  // Scale down to speed up Sobel calculations
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 120, 120);
  const data = ctx.getImageData(0, 0, 120, 120).data;
  
  const width = 120;
  const height = 120;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = Math.round(data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
  }
  
  // Calculate Sobel magnitudes
  const magnitudes: number[] = [];
  let sum = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Kernels
      const gx =
        -1 * gray[(y - 1) * width + (x - 1)] +
        1 * gray[(y - 1) * width + (x + 1)] +
        -2 * gray[y * width + (x - 1)] +
        2 * gray[y * width + (x + 1)] +
        -1 * gray[(y + 1) * width + (x - 1)] +
        1 * gray[(y + 1) * width + (x + 1)];

      const gy =
        -1 * gray[(y - 1) * width + (x - 1)] +
        -2 * gray[(y - 1) * width + x] +
        -1 * gray[(y - 1) * width + (x + 1)] +
        1 * gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        1 * gray[(y + 1) * width + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      magnitudes.push(mag);
      sum += mag;
    }
  }
  
  const mean = sum / magnitudes.length;
  let varianceSum = 0;
  for (const mag of magnitudes) {
    varianceSum += Math.pow(mag - mean, 2);
  }
  const variance = varianceSum / magnitudes.length;
  
  // Threshold: Variance below 85 indicates high blur
  return {
    isBlurry: variance < 85,
    score: Math.round(variance)
  };
}

/**
 * Modulates canvas to remove background. Uses thresholding chroma keyer.
 * Exposes a pipeline structure where we can plug in other background removers.
 */
export async function cleanupBackground(
  img: HTMLImageElement,
  provider: 'local' | 'external' = 'local'
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  if (provider === 'external') {
    // External API placeholder - falls back to local for MVP
    console.log('External background remover selected. Swapping to local canvas fallback.');
  }

  // Local Background Isolation:
  // Detects pixels that are near-white/gray, removes shadows, and converts them to pure white or transparent.
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Let's sample the corners to determine background color
  const sampleColor = (x: number, y: number) => {
    const idx = (y * canvas.width + x) * 4;
    return { r: data[idx], g: data[idx+1], b: data[idx+2] };
  };

  const corners = [
    sampleColor(5, 5),
    sampleColor(canvas.width - 5, 5),
    sampleColor(5, canvas.height - 5),
    sampleColor(canvas.width - 5, canvas.height - 5)
  ];
  
  const avgBg = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4)
  };

  // Threshold: Pixels with color difference less than 45 from the sampled background are set to pure white (#FFFFFF)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const diff = Math.sqrt(
      Math.pow(r - avgBg.r, 2) +
      Math.pow(g - avgBg.g, 2) +
      Math.pow(b - avgBg.b, 2)
    );

    if (diff < 48) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Crops margins and centers the footwear product in a clean white canvas.
 */
export function cropAndCenter(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = sourceCanvas.getContext('2d')!;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Find bounding box of non-white pixels
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      
      // If pixel is not pure white
      if (r < 254 || g < 254 || b < 254) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return sourceCanvas; // Return original if no item detected

  // Extract shoe bounding box
  const cropW = (maxX - minX) + 1;
  const cropH = (maxY - minY) + 1;
  
  // Create final centered padded square canvas (feels premium)
  const targetSize = Math.max(cropW, cropH) * 1.25; // 25% padding
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = targetSize;
  outputCanvas.height = targetSize;
  const outCtx = outputCanvas.getContext('2d')!;
  
  // Fill background with white
  outCtx.fillStyle = '#FFFFFF';
  outCtx.fillRect(0, 0, targetSize, targetSize);
  
  // Center cropped image in the output square
  const dx = (targetSize - cropW) / 2;
  const dy = (targetSize - cropH) / 2;
  
  outCtx.drawImage(
    sourceCanvas,
    minX, minY, cropW, cropH, // Source
    dx, dy, cropW, cropH      // Target
  );

  return outputCanvas;
}

/**
 * Resizes canvas to a target maximum dimension and exports WebP format.
 */
export function compressToWebP(
  canvas: HTMLCanvasElement,
  maxDimension = 1200,
  quality = 0.8
): string {
  const w = canvas.width;
  const h = canvas.height;
  let targetW = w;
  let targetH = h;

  if (w > maxDimension || h > maxDimension) {
    if (w > h) {
      targetW = maxDimension;
      targetH = Math.round((h * maxDimension) / w);
    } else {
      targetH = maxDimension;
      targetW = Math.round((w * maxDimension) / h);
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const ctx = outCanvas.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  
  return outCanvas.toDataURL('image/webp', quality);
}

/**
 * Core image processing pipeline orchestrator.
 */
export async function runImagePipeline(
  file: File,
  bgRemover: 'local' | 'external' = 'local'
): Promise<ProcessedImageResult> {
  // 1. Import & Validate Load
  const img = await fileToImage(file);

  // 2. Validate Blur
  const blurResult = detectBlur(img);

  // 3. Background Cleanup
  const bgCleaned = await cleanupBackground(img, bgRemover);

  // 4. Crop & Center
  const centered = cropAndCenter(bgCleaned);

  // 5. Compress WebP (1200px)
  const originalBase64 = compressToWebP(centered, 1200, 0.82);

  // 6. Thumbnail (150px WebP)
  const thumbnailBase64 = compressToWebP(centered, 150, 0.75);

  // 7. Composite Hash (computed from original image to avoid background modification skew)
  const compositeHash = computeCompositeHash(img);

  return {
    originalBase64,
    thumbnailBase64,
    compositeHash,
    isBlurry: blurResult.isBlurry,
    blurScore: blurResult.score
  };
}
