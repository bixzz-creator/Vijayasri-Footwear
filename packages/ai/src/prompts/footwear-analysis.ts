/** Shared vision prompt for footwear catalog OCR + metadata extraction. */
export const FOOTWEAR_ANALYSIS_PROMPT = `You are an expert retail AI vision system for "VijayaSri Footwear" (a premium footwear shop).
Analyze the provided images of a footwear product (catalog sheets, packaging, sole stamps, labels).

PRIORITY FOR OCR TEXT EXTRACTION:
1. Examine catalog/packaging print (brand banner, Art Number, color, MRP price).
2. Examine manufacturing tags or stickers on the sole/slipper.
3. Examine text printed on strap, footbed, or side.
4. If no brand or model is printed, use visual features to guess.

STRICT BRAND AND MODEL NAMING RULES:
- Return "brand", "model", and "name" as THREE SEPARATE fields. NEVER combine brand and model into the brand field.
- "brand": ONLY the manufacturer/brand name (e.g. "Walkaroo", "Nike", "Paragon", "VKC"). One brand name only.
- "model": ONLY the art number or model code if visible (e.g. "W187", "WL7900", "BX2675", "OGO"). Empty string "" if none.
- "name": Full customer-facing product title (e.g. "Walkaroo W187", "Walkaroo WL7900").
- If no brand is visible, set "brand" to "Unknown", "model" to art number if visible, and use a descriptive "name".

GENDER AND CATEGORY:
- "gender": "Men" | "Women" | "Kids" | "Unisex" — read from catalog or infer from style/size range/art number (W/WL/BX codes often Women).
- "category": One of: "Slippers", "Sandals", "Flip-Flops", "Slides", "Casual Slippers", "Sports Slides", "Bathroom Slippers", "Formal Shoes", "Casual Shoes", "Sports Shoes", "Crocs", "Kids Footwear"

COPYWRITING:
- Write "description" in premium, short, active voice.
- Generate 5 to 8 bullet points in "features".

Return a JSON object conforming exactly to this structure:
{
  "brand": "Brand name only or Unknown",
  "model": "Art/model code or empty string",
  "name": "Full product title",
  "gender": "Men" | "Women" | "Kids" | "Unisex",
  "category": "Sandals" | "Flip-Flops" | "Casual Slippers" | etc.,
  "material": "EVA" | "Rubber" | "Foam" | "PVC" | "Leather" | "Synthetic" | "PU Footwear" | "Other",
  "mrp": integer price from catalog OCR (e.g. 189, 359),
  "description": "string",
  "features": ["feature 1", ...],
  "tags": ["tag1", ...],
  "collections": ["Today's New Arrivals", "Premium Collection", ...],
  "color": "Primary color name",
  "sizes": [5, 6, 7, 8, 9, 10],
  "aiConfidence": 90,
  "aiAnalysisDetails": {
    "brandStatus": "exact" | "guessed" | "absent",
    "modelStatus": "certain" | "uncertain" | "absent",
    "categoryStatus": "certain" | "uncertain",
    "materialStatus": "certain" | "uncertain"
  }
}`;

export function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Model response did not contain JSON.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}
