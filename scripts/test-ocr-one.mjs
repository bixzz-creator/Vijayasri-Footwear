import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

const imagePath = process.argv[2] || String.raw`D:\VijayaSri Footwear\sleppers\WhatsApp Image 2026-07-10 at 1.37.07 PM.jpeg`;

const meta = await sharp(imagePath).metadata();
const w = meta.width || 800;
const h = meta.height || 1200;

// Bottom 45% where catalog text lives
const bottomStrip = await sharp(imagePath)
  .extract({ left: 0, top: Math.floor(h * 0.55), width: w, height: Math.floor(h * 0.45) })
  .grayscale()
  .normalize()
  .sharpen()
  .png()
  .toBuffer();

const { data: { text } } = await Tesseract.recognize(bottomStrip, 'eng', {
  logger: () => {},
});
console.log('--- OCR bottom strip ---');
console.log(text);
console.log('--- full image ---');
const { data: { text: full } } = await Tesseract.recognize(imagePath, 'eng', { logger: () => {} });
console.log(full.slice(0, 800));
