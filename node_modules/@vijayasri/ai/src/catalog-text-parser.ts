/** Parse raw OCR text from Indian footwear catalog photos (Walkaroo, Paragon, etc.). */

export interface ParsedCatalogText {
  brand: string;
  artNumber: string | null;
  color: string;
  price: number | null;
  gender: string;
  category: string;
}

const KNOWN_COLORS = [
  'french beige', 'maroon', 'black', 'white', 'blue', 'red', 'brown', 'grey', 'gray',
  'green', 'yellow', 'orange', 'pink', 'purple', 'beige', 'tan', 'navy', 'gold',
  'cream', 'wine', 'mustard', 'peach', 'turquoise', 'cyan', 'magenta', 'olive',
  'silver', 'copper', 'bronze', 'lavender', 'coral', 'mint', 'khaki', 'coffee',
  'chocolate', 'burgundy', 'teal', 'lime', 'rose', 'sand', 'camel', 'ivory',
  'charcoal', 'off white', 'off-white', 'dark brown', 'light brown', 'dark blue',
  'light blue', 'navy blue', 'sky blue', 'forest green', 'olive green',
];

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isNoiseColorLine(line: string): boolean {
  const upper = line.toUpperCase();
  return (
    upper.includes('ART') ||
    upper.includes('WALKAROO') ||
    upper.includes('FOOTWEAR') ||
    upper.includes('NUMBER') ||
    upper.includes('MRP') ||
    upper.includes('SIZE') ||
    upper.includes('CHART') ||
    /^\d/.test(line) ||
    /\d\s*[xX×]\s*\d/.test(line) ||
    /^[₹¥]/.test(line) ||
    /^\d{2,3}\.\d{2}/.test(line)
  );
}

export function parsePriceFromOcr(text: string): number | null {
  const candidates: number[] = [];
  for (const m of text.matchAll(/(\d{1,4})[\.,](\d{2})/g)) {
    let whole = parseInt(m[1], 10);
    if (whole >= 1000) whole = parseInt(String(whole).slice(-3), 10);
    if (whole >= 99 && whole <= 999) candidates.push(whole);
  }
  for (const m of text.matchAll(/[₹¥]\s*(\d{2,3})(?:[\.,](\d{2}))?/g)) {
    const whole = parseInt(m[1], 10);
    if (whole >= 99 && whole <= 999) candidates.push(whole);
  }
  for (const m of text.matchAll(/\bMRP[\s:]*(\d{2,3})\b/gi)) {
    const whole = parseInt(m[1], 10);
    if (whole >= 99 && whole <= 999) candidates.push(whole);
  }
  return candidates.length ? candidates[0] : null;
}

export function parseArtNumberFromOcr(text: string): string | null {
  const nearArtCombined = text.match(
    /Art\s*Number[\s:\-]*[\s\S]{0,40}?([A-Z]{0,4}\d{3,6}[A-Z]?|\d{4,6})/i
  );
  if (nearArtCombined?.[1]) {
    return nearArtCombined[1].toUpperCase().replace(/\s/g, '');
  }

  const upper = text.toUpperCase();
  const letterCodes = [...upper.matchAll(/\b([BW][LX]?\d{3,5}|BX\d{3,5}|WL\d{3,5}|W\d{3,4}[A-Z]?)\b/g)]
    .map(m => m[1]);
  if (letterCodes.length) return letterCodes[letterCodes.length - 1];

  const price = parsePriceFromOcr(text);
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

export function parseColorFromOcr(text: string): string {
  const sortedColors = [...KNOWN_COLORS].sort((a, b) => b.length - a.length);
  for (const known of sortedColors) {
    const pattern = new RegExp(`\\b${known.replace(/\s+/g, '[\\s_-]+')}\\b`, 'i');
    if (pattern.test(text)) {
      return titleCase(known);
    }
  }

  const lines = text.toUpperCase().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (isNoiseColorLine(line)) continue;
    if (/^[A-Z][A-Z\s-]{2,24}$/.test(line)) {
      return titleCase(sanitizeToken(line).replace(/_/g, ' '));
    }
  }

  return 'Standard';
}

export function parseBrandFromOcr(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes('BASIX')) return 'Walkaroo BASIX';
  if (upper.includes('WALKAROO')) return 'Walkaroo';
  if (upper.includes('PARAGON')) return 'Paragon';
  if (upper.includes('VKC')) return 'VKC';
  if (upper.includes('SPARX')) return 'Sparx';
  if (upper.includes('BATA')) return 'Bata';
  return 'Walkaroo';
}

/** Infer Men/Women/Kids from size chart labels like "06 X 10" on catalog strips. */
export function inferGenderFromSizeChart(ocrText: string): string | null {
  const match = ocrText.match(/\b(\d{1,2})\s*[xX×]\s*(\d{1,2})\b/);
  if (!match) return null;

  const low = parseInt(match[1], 10);
  const high = parseInt(match[2], 10);
  if (Number.isNaN(low) || Number.isNaN(high) || low > high) return null;

  if (high <= 5 || (high <= 6 && low <= 2)) return 'Kids';
  if (low >= 6 || (low >= 5 && high >= 10)) return 'Men';
  if (low <= 4 && high <= 9) return 'Women';
  if (low >= 3 && high <= 8) return 'Women';

  return null;
}

export function inferGenderFromArtNumber(artNumber: string, ocrText = ''): string {
  const text = ocrText.toLowerCase();
  if (/\b(women|woman|ladies|lady|girls|female)\b/.test(text)) return 'Women';
  if (/\b(men|man|gents|gentlemen|boys|male)\b/.test(text)) return 'Men';
  if (/\b(kids|kid|junior|children|child|infant)\b/.test(text)) return 'Kids';
  if (/\bunisex\b/.test(text)) return 'Unisex';

  const fromSize = inferGenderFromSizeChart(ocrText);
  if (fromSize) return fromSize;

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

export function inferCategoryFromCatalog(artNumber: string, ocrText = '', gender = 'Unisex'): string {
  const text = ocrText.toUpperCase();
  const art = (artNumber || '').toUpperCase();

  if (/FORMAL|LOAFER|OXFORD|DERBY|BROGUE|MOCCASIN|DRESS\s*SHOE/.test(text)) return 'Formal Shoes';
  if (/SNEAKER|RUNNING|TRAINER|SPORTS\s*SHOE/.test(text)) return 'Sports Shoes';
  if (/CASUAL\s*SHOE/.test(text)) return 'Casual Shoes';
  if (/FLIP.?FLOP|HAWAII|THONG/.test(text)) return 'Flip-Flops';
  if (/BATH.?ROOM|BATH\b/.test(text)) return 'Bathroom Slippers';
  if (/SPORT/.test(text)) return 'Sports Slides';
  if (/SANDAL|BUCKLE|TOE.?LOOP|STRAP/.test(text)) return 'Sandals';
  if (/SLIDE/.test(text)) return 'Slides';
  if (/\bSHOE\b/.test(text) && !/SLIPPER|FLIP|SANDAL/.test(text)) return 'Formal Shoes';

  if (/^17\d{3}$/.test(art) || /^16\d{3}$/.test(art)) return 'Formal Shoes';
  if (/^W\d{2,4}[A-Z]?$/.test(art)) return 'Flip-Flops';
  if (/^BX/.test(art)) return 'Sandals';
  if (/^WLR|^WLP|^WL/.test(art)) return 'Sandals';
  if (/^WF|^WC|^WE|^WES/.test(art)) return 'Casual Slippers';
  if (/^FLR/.test(art)) return 'Sandals';

  if (gender === 'Men') return 'Casual Slippers';
  if (gender === 'Women') return 'Sandals';
  return 'Casual Slippers';
}

export function parseCatalogOcrText(text: string): ParsedCatalogText {
  const brand = parseBrandFromOcr(text);
  const artNumber = parseArtNumberFromOcr(text);
  const color = parseColorFromOcr(text);
  const price = parsePriceFromOcr(text);
  const gender = inferGenderFromArtNumber(artNumber || '', text);
  const category = inferCategoryFromCatalog(artNumber || '', text, gender);

  return { brand, artNumber, color, price, gender, category };
}
