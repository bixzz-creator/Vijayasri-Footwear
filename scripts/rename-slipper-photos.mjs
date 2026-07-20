/**
 * Analyze Walkaroo-style catalog slipper photos and rename them for bulk import.
 *
 * Usage:
 *   node scripts/rename-slipper-photos.mjs                              # Tesseract OCR (free, local)
 *   node scripts/rename-slipper-photos.mjs --engine ocrspace              # OCR.space API (needs key)
 *   node scripts/rename-slipper-photos.mjs --ocr-key YOUR_KEY               # pass key on CLI
 *   node scripts/rename-slipper-photos.mjs --dry-run --engine ocrspace      # preview only
 *   node scripts/rename-slipper-photos.mjs --folder "D:\path\to\photos"
 *
 * OCR key can also be set in .env as OCR_API_KEY=...
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FOLDER = path.join('D:', 'VijayaSri Footwear', 'sleppers');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const folderArg = args.find((a, i) => args[i - 1] === '--folder');
const engineArg = args.find((a, i) => args[i - 1] === '--engine');
const ocrKeyArg = args.find((a, i) => args[i - 1] === '--ocr-key');
const geminiKeyArg = args.find((a, i) => args[i - 1] === '--gemini-key');
const openRouterKeyArg = args.find((a, i) => args[i - 1] === '--openrouter-key');
const openRouterModelArg = args.find((a, i) => args[i - 1] === '--openrouter-model');
const SOURCE_FOLDER = path.resolve(folderArg || DEFAULT_FOLDER);
const MANIFEST_PATH = path.join(SOURCE_FOLDER, 'rename-manifest.csv');
const LOG_PATH = path.join(SOURCE_FOLDER, 'rename-log.txt');

const OCR_SPACE_API = 'https://api.ocr.space/parse/image';
const GEMINI_MODEL = 'gemini-2.5-flash';
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

const CATALOG_OCR_PROMPT = `You are an expert OCR system for Indian footwear catalog/packaging photos (Walkaroo, Paragon, VKC, etc.).

Read ALL printed text on the image — brand banner, Art Number, color name, MRP price, size chart labels.

Extract and return JSON ONLY (no markdown):
{
  "brand": "Walkaroo or Paragon etc.",
  "artNumber": "Model/Art code e.g. W187, BX2554, WL7900",
  "color": "Primary color e.g. Maroon, Blue, French Beige",
  "price": integer MRP from catalog (e.g. 189, 299, 359) or null,
  "gender": "Men" | "Women" | "Kids" | "Unisex",
  "category": "Sandals" | "Flip-Flops" | "Slides" | "Casual Slippers" | "Sports Slides" | "Bathroom Slippers"
}

Rules:
- Art Number is often labeled "Art Number" or printed as codes like BX2554, W187, WL7900.
- Price is the MRP in rupees (usually 99–999).
- BX/WL/W codes often indicate Women; infer gender from catalog text or art number.
- Read the bottom catalog strip carefully — that is where Art Number, color, and price usually appear.`;

function loadEnvKey(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return '';
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`));
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

const ocrApiKey = ocrKeyArg?.trim() || loadEnvKey('OCR_API_KEY');
const geminiKey = geminiKeyArg?.trim() || loadEnvKey('GEMINI_API_KEY');
const openRouterKey = openRouterKeyArg?.trim() || loadEnvKey('OPENROUTER_API_KEY');
const openRouterModel = openRouterModelArg?.trim() || 'google/gemini-2.0-flash-001';

const requestedEngine = (engineArg || '').toLowerCase();
let engine = 'tesseract';
if (requestedEngine === 'ocrspace' || (!requestedEngine && ocrApiKey)) {
  engine = ocrApiKey ? 'ocrspace' : null;
} else if (requestedEngine === 'gemini' || (!requestedEngine && geminiKey)) {
  engine = geminiKey ? 'gemini' : null;
} else if (requestedEngine === 'openrouter' || (!requestedEngine && openRouterKey && !ocrApiKey && !geminiKey)) {
  engine = openRouterKey ? 'openrouter' : null;
} else if (requestedEngine === 'tesseract' || !requestedEngine) {
  engine = 'tesseract';
}

if (requestedEngine === 'ocrspace' && !ocrApiKey) {
  console.error('OCR.space engine selected but no API key found.');
  console.error('Use --ocr-key YOUR_KEY or set OCR_API_KEY in .env');
  process.exit(1);
}
if (requestedEngine === 'gemini' && !geminiKey) {
  console.error('Gemini engine selected but no API key found.');
  console.error('Use --gemini-key AIza... or set GEMINI_API_KEY in .env');
  process.exit(1);
}
if (requestedEngine === 'openrouter' && !openRouterKey) {
  console.error('OpenRouter engine selected but no API key found.');
  console.error('Use --openrouter-key sk-or-v1-... or set OPENROUTER_API_KEY in .env');
  process.exit(1);
}
if (!engine) {
  console.error('Could not resolve OCR engine. Provide --ocr-key or use --engine tesseract.');
  process.exit(1);
}

const CONCURRENCY = engine === 'ocrspace' || engine === 'gemini' || engine === 'openrouter' ? 2 : 2;

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const KNOWN_COLORS = [
  'french beige', 'maroon', 'black', 'white', 'blue', 'red', 'brown', 'grey', 'gray',
  'green', 'yellow', 'orange', 'pink', 'purple', 'beige', 'tan', 'navy', 'gold',
  'cream', 'wine', 'mustard', 'peach', 'turquoise', 'cyan', 'magenta', 'olive',
  'silver', 'copper', 'bronze', 'lavender', 'coral', 'mint', 'khaki', 'coffee',
  'chocolate', 'burgundy', 'teal', 'lime', 'rose', 'sand', 'camel', 'ivory',
];

function listImages(dir) {
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .filter(f => !['rename-manifest.csv', 'rename-log.txt'].includes(f.toLowerCase()))
    .map(f => path.join(dir, f))
    .sort();
}

function sanitizeToken(value) {
  return value
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function parsePrice(text) {
  const candidates = [];
  for (const m of text.matchAll(/(\d{1,4})[\.,](\d{2})/g)) {
    let whole = parseInt(m[1], 10);
    if (whole >= 1000) {
      whole = parseInt(String(whole).slice(-3), 10);
    }
    if (whole >= 99 && whole <= 999) {
      candidates.push(whole);
    }
  }
  for (const m of text.matchAll(/[₹¥]\s*(\d{2,3})(?:[\.,](\d{2}))?/g)) {
    const whole = parseInt(m[1], 10);
    if (whole >= 99 && whole <= 999) candidates.push(whole);
  }
  return candidates.length ? candidates[0] : null;
}

function parseArtNumber(text) {
  const nearArtCombined = text.match(
    /Art\s*Number[\s:\-]*[\s\S]{0,40}?([A-Z]{0,4}\d{3,6}[A-Z]?|\d{4,6})/i
  );
  if (nearArtCombined?.[1]) {
    return nearArtCombined[1].toUpperCase().replace(/\s/g, '');
  }

  const upper = text.toUpperCase();
  const codes = [...upper.matchAll(/\b([BW][LX]?\d{3,5}|BX\d{3,5}|WL\d{3,5}|W\d{3,4}[A-Z]?)\b/g)]
    .map(m => m[1]);
  if (codes.length) return codes[codes.length - 1];

  const price = parsePrice(text);
  const numericCodes = [...text.matchAll(/\b(\d{4,6})\b/g)]
    .map(m => m[1])
    .filter(code => {
      const num = parseInt(code, 10);
      if (num < 1000 || num > 999999) return false;
      if (price !== null && String(price) === code) return false;
      if (price !== null && code.endsWith(String(price))) return false;
      return true;
    });
  if (numericCodes.length) return numericCodes[numericCodes.length - 1];

  return null;
}

function isNoiseColorLine(line) {
  const upper = line.toUpperCase();
  return (
    upper.includes('ART') ||
    upper.includes('WALKAROO') ||
    upper.includes('FOOTWEAR') ||
    upper.includes('NUMBER') ||
    upper.includes('MRP') ||
    upper.includes('SIZE') ||
    /^\d/.test(line) ||
    /\d\s*[xX×]\s*\d/.test(line) ||
    /^[₹¥]/.test(line)
  );
}

function parseColor(text) {
  const sortedColors = [...KNOWN_COLORS].sort((a, b) => b.length - a.length);
  for (const known of sortedColors) {
    const pattern = new RegExp(`\\b${known.replace(/\s+/g, '[\\s_-]+')}\\b`, 'i');
    if (pattern.test(text)) {
      return known.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('_');
    }
  }

  const lines = text.toUpperCase().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (isNoiseColorLine(line)) continue;
    if (/^[A-Z][A-Z\s-]{2,24}$/.test(line)) {
      return sanitizeToken(line);
    }
  }
  return 'Standard';
}

function parseBrand(text) {
  const upper = text.toUpperCase();
  if (upper.includes('BASIX')) return 'Walkaroo_BASIX';
  if (upper.includes('WALKAROO')) return 'Walkaroo';
  if (upper.includes('PARAGON')) return 'Paragon';
  if (upper.includes('VKC')) return 'VKC';
  if (upper.includes('SPARX')) return 'Sparx';
  if (upper.includes('BATA')) return 'Bata';
  return 'Walkaroo';
}

function parseCatalogOcr(text) {
  const brand = parseBrand(text);
  const artNumber = parseArtNumber(text);
  const color = parseColor(text);
  const price = parsePrice(text);
  const gender = inferGenderFromArtNumber(artNumber || '', text);
  const category = inferCategoryFromCatalog(artNumber || '', text, gender);

  return { brand, artNumber, color, price, gender, category };
}

function inferGenderFromArtNumber(artNumber, ocrText = '') {
  const text = ocrText.toLowerCase();
  if (/\b(women|woman|ladies|lady|girls|female)\b/.test(text)) return 'Women';
  if (/\b(men|man|gents|gentlemen|boys|male)\b/.test(text)) return 'Men';
  if (/\b(kids|kid|junior|children|child|infant)\b/.test(text)) return 'Kids';
  if (/\bunisex\b/.test(text)) return 'Unisex';

  const sizeMatch = ocrText.match(/\b(\d{1,2})\s*[xX×]\s*(\d{1,2})\b/);
  if (sizeMatch) {
    const low = parseInt(sizeMatch[1], 10);
    const high = parseInt(sizeMatch[2], 10);
    if (!Number.isNaN(low) && !Number.isNaN(high) && low <= high) {
      if (high <= 5 || (high <= 6 && low <= 2)) return 'Kids';
      if (low >= 6 || (low >= 5 && high >= 10)) return 'Men';
      if (low <= 4 && high <= 9) return 'Women';
      if (low >= 3 && high <= 8) return 'Women';
    }
  }

  const art = (artNumber || '').toUpperCase();
  if (!art) return 'Unisex';
  if (/^BX/.test(art)) return 'Women';
  if (/^WLR|^WLP|^WL/.test(art)) return 'Women';
  if (/^WF|^WC|^WE|^WES|^FLR/.test(art)) return 'Women';
  if (/^W\d{2,4}[A-Z]?$/.test(art)) return 'Women';
  if (/^M[LRS]?/.test(art) || /^M\d/.test(art)) return 'Men';
  if (/^K\d|^KIDS/.test(art)) return 'Kids';
  if (/^17\d{3}$/.test(art) || /^16\d{3}$/.test(art)) return 'Men';
  return 'Unisex';
}

function inferCategoryFromCatalog(artNumber, ocrText = '', gender = 'Unisex') {
  const text = ocrText.toUpperCase();
  const art = (artNumber || '').toUpperCase();
  if (/FORMAL|LOAFER|OXFORD|DERBY|BROGUE|MOCCASIN|DRESS\s*SHOE/.test(text)) return 'Formal_Shoes';
  if (/SNEAKER|RUNNING|TRAINER|SPORTS\s*SHOE/.test(text)) return 'Sports_Shoes';
  if (/CASUAL\s*SHOE/.test(text)) return 'Casual_Shoes';
  if (/FLIP.?FLOP|HAWAII|THONG/.test(text)) return 'Flip_Flops';
  if (/BATH.?ROOM|BATH\b/.test(text)) return 'Bathroom_Slippers';
  if (/SPORT/.test(text)) return 'Sports_Slides';
  if (/SANDAL|BUCKLE|TOE.?LOOP|STRAP/.test(text)) return 'Sandals';
  if (/SLIDE/.test(text)) return 'Slides';
  if (/\bSHOE\b/.test(text) && !/SLIPPER|FLIP|SANDAL/.test(text)) return 'Formal_Shoes';
  if (/^17\d{3}$/.test(art) || /^16\d{3}$/.test(art)) return 'Formal_Shoes';
  if (/^W\d{2,4}[A-Z]?$/.test(art)) return 'Flip_Flops';
  if (/^BX/.test(art)) return 'Sandals';
  if (/^WLR|^WLP|^WL/.test(art)) return 'Sandals';
  if (/^WF|^WC|^WE|^WES/.test(art)) return 'Casual_Slippers';
  if (/^FLR/.test(art)) return 'Sandals';
  if (gender === 'Men') return 'Casual_Slippers';
  if (gender === 'Women') return 'Sandals';
  return 'Casual_Slippers';
}

function normalizeCategoryFromAi(category) {
  const c = (category || '').trim();
  if (!c) return 'Casual_Slippers';
  return c.replace(/-/g, '_').replace(/\s+/g, '_');
}

function categoryFileToken(category) {
  return category.replace(/-/g, '_').replace(/\s+/g, '_');
}

function genderFileToken(gender) {
  return gender;
}

function buildFilename(meta, ext, usedNames) {
  const parts = [
    sanitizeToken(meta.brand),
    genderFileToken(meta.gender || 'Unisex'),
    categoryFileToken(meta.category || 'Casual_Slippers'),
    meta.artNumber || 'Unknown',
    meta.color,
    meta.price ? String(meta.price) : '499',
  ].filter(Boolean);

  let base = parts.join('_');
  let candidate = `${base}${ext}`;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter}${ext}`;
    counter++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function parseJsonFromText(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in model response');
  return JSON.parse(raw.slice(start, end + 1));
}

function extractOpenRouterText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter(p => p.type === 'text' && p.text).map(p => p.text).join('\n');
  }
  throw new Error('OpenRouter response had no text');
}

async function ocrSpaceImage(imagePath) {
  const buffer = await fs.promises.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    'image/jpeg';
  const filetype =
    ext === '.png' ? 'PNG' :
    ext === '.gif' ? 'GIF' :
    'JPG';
  const base64 = buffer.toString('base64');

  const form = new FormData();
  form.set('apikey', ocrApiKey);
  form.set('base64Image', `data:${mime};base64,${base64}`);
  form.set('filetype', filetype);
  form.set('language', 'eng');
  form.set('OCREngine', '2');
  form.set('isOverlayRequired', 'false');
  form.set('detectOrientation', 'true');
  form.set('scale', 'true');

  const response = await fetch(OCR_SPACE_API, {
    method: 'POST',
    headers: { apikey: ocrApiKey },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.IsErroredOnProcessing) {
    const msg = Array.isArray(payload.ErrorMessage)
      ? payload.ErrorMessage.join('; ')
      : payload.ErrorMessage ?? response.statusText;
    throw new Error(msg || 'OCR.space failed');
  }

  const text = payload.ParsedResults?.[0]?.ParsedText ?? '';
  const parsed = parseCatalogOcr(text);
  return { ...parsed, engine: 'ocrspace', model: 'OCR.space Engine 2' };
}

async function geminiOcrImage(imagePath) {
  const buffer = await fs.promises.readFile(imagePath);
  const base64 = buffer.toString('base64');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `${CATALOG_OCR_PROMPT}\n\nRespond with ONLY valid JSON.` },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? response.statusText);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') ?? '';
  const parsed = parseJsonFromText(text);
  const artNumber = String(parsed.artNumber ?? parsed.model ?? '').trim().toUpperCase() || null;
  const gender = parsed.gender || inferGenderFromArtNumber(artNumber || '', '');
  const category = normalizeCategoryFromAi(parsed.category) || inferCategoryFromCatalog(artNumber || '', '', gender);

  return {
    brand: sanitizeToken(parsed.brand || 'Walkaroo') || 'Walkaroo',
    artNumber,
    color: sanitizeToken(parsed.color || 'Standard') || 'Standard',
    price: typeof parsed.price === 'number' ? parsed.price : typeof parsed.mrp === 'number' ? parsed.mrp : null,
    gender,
    category,
    engine: 'gemini',
    model: GEMINI_MODEL,
  };
}

async function openRouterOcrImage(imagePath) {
  const buffer = await fs.promises.readFile(imagePath);
  const base64 = buffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const candidates = [
    openRouterModel,
    ...OPENROUTER_VISION_MODELS.filter(m => m !== openRouterModel),
  ];

  let lastError = '';

  for (const model of candidates) {
    try {
      const response = await fetch(OPENROUTER_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vijayasri-footwear.local',
          'X-Title': 'VijayaSri Footwear Catalog Rename',
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: `${CATALOG_OCR_PROMPT}\n\nRespond with ONLY valid JSON.` },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = payload?.error?.message ?? response.statusText;
        continue;
      }

      const parsed = parseJsonFromText(extractOpenRouterText(payload));
      const artNumber = String(parsed.artNumber ?? parsed.model ?? '').trim().toUpperCase() || null;
      const gender = parsed.gender || inferGenderFromArtNumber(artNumber || '', '');
      const category = normalizeCategoryFromAi(parsed.category) || inferCategoryFromCatalog(artNumber || '', '', gender);

      return {
        brand: sanitizeToken(parsed.brand || 'Walkaroo') || 'Walkaroo',
        artNumber,
        color: sanitizeToken(parsed.color || 'Standard') || 'Standard',
        price: typeof parsed.price === 'number' ? parsed.price : typeof parsed.mrp === 'number' ? parsed.mrp : null,
        gender,
        category,
        engine: 'openrouter',
        model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`OpenRouter OCR failed: ${lastError}`);
}

async function tesseractOcrImage(imagePath) {
  const meta = await sharp(imagePath).metadata();
  const w = meta.width || 800;
  const h = meta.height || 1200;

  const bottomStrip = await sharp(imagePath)
    .extract({ left: 0, top: Math.floor(h * 0.52), width: w, height: Math.floor(h * 0.48) })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

  const { data: { text: bottomText } } = await Tesseract.recognize(bottomStrip, 'eng', {
    logger: () => {},
  });

  let parsed = parseCatalogOcr(bottomText);

  if (!parsed.artNumber || !parsed.price) {
    const { data: { text: fullText } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: () => {},
    });
    const fullParsed = parseCatalogOcr(fullText);
    parsed = {
      brand: parsed.brand !== 'Walkaroo' ? parsed.brand : fullParsed.brand,
      artNumber: parsed.artNumber || fullParsed.artNumber,
      color: parsed.color !== 'Standard' ? parsed.color : fullParsed.color,
      price: parsed.price || fullParsed.price,
      gender: parsed.gender !== 'Unisex' ? parsed.gender : fullParsed.gender,
      category: parsed.category !== 'Casual_Slippers' ? parsed.category : fullParsed.category,
    };
  }

  return { ...parsed, engine: 'tesseract' };
}

async function analyzeImage(imagePath) {
  if (engine === 'ocrspace') {
    return ocrSpaceImage(imagePath);
  }
  if (engine === 'gemini') {
    return geminiOcrImage(imagePath);
  }
  if (engine === 'openrouter') {
    return openRouterOcrImage(imagePath);
  }
  return tesseractOcrImage(imagePath);
}

async function processBatch(files, startIdx, usedNames, results) {
  const chunk = files.slice(startIdx, startIdx + CONCURRENCY);
  await Promise.all(chunk.map(async (filePath, offset) => {
    const idx = startIdx + offset;
    const oldName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      const meta = await analyzeImage(filePath);
      const newName = buildFilename(meta, ext, usedNames);
      results[idx] = { oldName, newName, ...meta, status: 'ok', error: '' };
      process.stdout.write(`[${idx + 1}/${files.length}] ${oldName} → ${newName} (${meta.engine})\n`);
    } catch (err) {
      const fallback = buildFilename(
        {
          brand: 'Walkaroo',
          artNumber: `IMG${String(idx + 1).padStart(4, '0')}`,
          color: 'Standard',
          price: 499,
          gender: 'Unisex',
          category: 'Casual_Slippers',
        },
        ext,
        usedNames
      );
      results[idx] = {
        oldName,
        newName: fallback,
        brand: 'Walkaroo',
        artNumber: `IMG${String(idx + 1).padStart(4, '0')}`,
        color: 'Standard',
        price: 499,
        gender: 'Unisex',
        category: 'Casual_Slippers',
        engine: engine || 'tesseract',
        status: 'fallback',
        error: err instanceof Error ? err.message : String(err),
      };
      process.stdout.write(`[${idx + 1}/${files.length}] ${oldName} → ${fallback} (OCR failed)\n`);
    }
  }));
}

function escapeCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  if (!fs.existsSync(SOURCE_FOLDER)) {
    console.error(`Folder not found: ${SOURCE_FOLDER}`);
    process.exit(1);
  }

  const files = listImages(SOURCE_FOLDER);
  console.log(`Found ${files.length} images in ${SOURCE_FOLDER}`);
  console.log(`OCR engine: ${engine}${engine === 'ocrspace' ? ' (OCR.space Engine 2)' : engine === 'gemini' ? ' (Gemini)' : engine === 'openrouter' ? ` (model: ${openRouterModel})` : ''}`);
  if (files.length === 0) process.exit(0);

  if (dryRun) console.log('DRY RUN — no files will be renamed\n');

  const usedNames = new Set(
    files.map(f => path.basename(f).toLowerCase())
  );
  const results = new Array(files.length);

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await processBatch(files, i, usedNames, results);
  }

  const manifestLines = [
    'old_name,new_name,brand,gender,category,art_number,color,price,engine,status,error',
    ...results.map(r =>
      [r.oldName, r.newName, r.brand, r.gender, r.category, r.artNumber, r.color, r.price, r.engine, r.status, r.error]
        .map(escapeCsv).join(',')
    ),
  ];

  if (!dryRun) {
    fs.writeFileSync(MANIFEST_PATH, manifestLines.join('\n'), 'utf8');
    fs.writeFileSync(LOG_PATH, manifestLines.join('\n'), 'utf8');
  }

  let renamed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const r = results[i];
    const newPath = path.join(SOURCE_FOLDER, r.newName);

    if (path.basename(filePath) === r.newName) {
      skipped++;
      continue;
    }

    if (dryRun) continue;

    if (fs.existsSync(newPath)) {
      console.warn(`Skip rename (target exists): ${r.newName}`);
      skipped++;
      continue;
    }

    fs.renameSync(filePath, newPath);
    renamed++;
  }

  console.log('\n--- Summary ---');
  console.log(`Total: ${files.length}`);
  console.log(`Renamed: ${dryRun ? 0 : renamed}`);
  console.log(`Skipped (same name or exists): ${skipped}`);
  console.log(`OCR failures (fallback names): ${results.filter(r => r.status === 'fallback').length}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  if (dryRun) {
    console.log('\nRun without --dry-run to apply renames.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
