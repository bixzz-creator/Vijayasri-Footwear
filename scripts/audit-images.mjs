/**
 * VijayaSri Footwear — Image Audit Script
 *
 * Scans sleppers/ for:
 *   1. Exact duplicates (SHA-256 hash collision)
 *   2. Near-duplicates (perceptual dHash, Hamming distance <= 8)
 *
 * Cross-references rename-manifest.csv to flag which files have already been
 * processed through the import pipeline (safe to delete if duplicate) vs.
 * which are not yet imported (must be kept even if duplicate).
 *
 * Outputs:
 *   sleppers/duplicates-report.md
 *   sleppers/safe-to-delete.txt  (byte-identical duplicates that ARE in manifest)
 *
 * Usage:
 *   node scripts/audit-images.mjs
 *   node scripts/audit-images.mjs --folder "D:\custom\path"
 *   node scripts/audit-images.mjs --threshold 12   (relax near-dup threshold)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const folderArg = args.find((a, i) => args[i - 1] === '--folder');
const thresholdArg = args.find((a, i) => args[i - 1] === '--threshold');

const SLEPPERS_FOLDER = path.resolve(folderArg || path.join(__dirname, '..', 'sleppers'));
const MANIFEST_PATH = path.join(SLEPPERS_FOLDER, 'rename-manifest.csv');
const REPORT_PATH = path.join(SLEPPERS_FOLDER, 'duplicates-report.md');
const SAFE_DELETE_PATH = path.join(SLEPPERS_FOLDER, 'safe-to-delete.txt');
const HAMMING_THRESHOLD = thresholdArg ? parseInt(thresholdArg, 10) : 8;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function sha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute a 64-bit difference hash (dHash) of an image using sharp.
 * Returns a BigInt representing the hash bits.
 */
async function dHash(filePath) {
  try {
    // Resize to 9x8 grayscale, then compare adjacent pixels across each row
    const { data } = await sharp(filePath)
      .resize(9, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let hash = 0n;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        hash = (hash << 1n) | (left < right ? 1n : 0n);
      }
    }
    return hash;
  } catch {
    return null; // corrupt / unreadable image
  }
}

function hammingDistance(a, b) {
  if (a === null || b === null) return Infinity;
  let diff = a ^ b;
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

// ─── Load manifest ────────────────────────────────────────────────────────────

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.warn('[Audit] rename-manifest.csv not found — cannot determine import status.');
    return new Set();
  }

  const lines = fs.readFileSync(MANIFEST_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  const importedNewNames = new Set();

  // CSV header: old_name,new_name,brand,art_number,color,price,status,error
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const newName = cols[1]?.trim();
    const status = cols[6]?.trim();
    if (newName && status === 'ok') {
      importedNewNames.add(newName);
    }
  }

  return importedNewNames;
}

// ─── Scan folder ─────────────────────────────────────────────────────────────

function scanImageFiles(folder) {
  if (!fs.existsSync(folder)) {
    console.error(`[Audit] Folder not found: ${folder}`);
    process.exit(1);
  }

  const results = [];
  const entries = fs.readdirSync(folder, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    const fullPath = path.join(folder, entry.name);
    const stat = fs.statSync(fullPath);
    results.push({ name: entry.name, fullPath, size: stat.size });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  VijayaSri Footwear — Image Audit');
  console.log('═══════════════════════════════════════════════');
  console.log(`Folder:    ${SLEPPERS_FOLDER}`);
  console.log(`Threshold: Hamming ≤ ${HAMMING_THRESHOLD} (near-dup)`);
  console.log('');

  // 1. Load manifest (which files have been through the rename pipeline)
  const importedFiles = loadManifest();
  console.log(`[Audit] Manifest loaded: ${importedFiles.size} imported file names`);

  // 2. Scan images
  const files = scanImageFiles(SLEPPERS_FOLDER);
  console.log(`[Audit] Found ${files.length} image files`);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`[Audit] Total size: ${formatBytes(totalBytes)}`);
  console.log('');

  // 3. Compute SHA-256 + dHash for each file
  console.log('[Audit] Computing hashes... (this may take ~30-60s)');
  const fileData = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    process.stdout.write(`\r  ${i + 1}/${files.length}: ${f.name.slice(0, 50).padEnd(52)}`);
    const sha = sha256(f.fullPath);
    const phash = await dHash(f.fullPath);
    const isImported = importedFiles.has(f.name);
    fileData.push({ ...f, sha, phash, isImported });
  }

  console.log('\n[Audit] Hashing complete.\n');

  // 4. Find exact duplicates (same SHA-256)
  const shaGroups = {};
  for (const f of fileData) {
    if (!shaGroups[f.sha]) shaGroups[f.sha] = [];
    shaGroups[f.sha].push(f);
  }

  const exactDupGroups = Object.values(shaGroups).filter(g => g.length > 1);
  console.log(`[Audit] Exact duplicate groups: ${exactDupGroups.length}`);

  // 5. Find near-duplicates (similar dHash, not already paired as exact)
  const exactDupFiles = new Set(exactDupGroups.flat().map(f => f.name));
  const nearDupPairs = [];
  const nonExactFiles = fileData.filter(f => !exactDupFiles.has(f.name) || true); // all files for near-dup

  for (let i = 0; i < fileData.length; i++) {
    for (let j = i + 1; j < fileData.length; j++) {
      const a = fileData[i];
      const b = fileData[j];
      // Skip pairs already in the same exact-dup group
      if (a.sha === b.sha) continue;
      const dist = hammingDistance(a.phash, b.phash);
      if (dist <= HAMMING_THRESHOLD) {
        nearDupPairs.push({ a, b, hamming: dist });
      }
    }
  }

  console.log(`[Audit] Near-duplicate pairs (hamming ≤ ${HAMMING_THRESHOLD}): ${nearDupPairs.length}`);

  // 6. Determine safe-to-delete candidates
  // Only byte-identical duplicates where at least one copy is already imported
  const safeToDelete = [];

  for (const group of exactDupGroups) {
    // Sort: prefer larger file (higher quality), then alphabetically shorter name
    const sorted = [...group].sort((a, b) => {
      if (b.size !== a.size) return b.size - a.size;
      return a.name.length - b.name.length;
    });

    const keep = sorted[0];
    const remove = sorted.slice(1);

    for (const f of remove) {
      const canDelete = f.isImported; // only delete if it went through the rename pipeline
      if (canDelete) {
        safeToDelete.push({ keep, remove: f, reason: 'exact-duplicate', canDelete: true });
      } else {
        safeToDelete.push({ keep, remove: f, reason: 'exact-duplicate', canDelete: false });
      }
    }
  }

  const deletablePaths = safeToDelete.filter(e => e.canDelete).map(e => e.remove.fullPath);

  // 7. Write safe-to-delete.txt
  fs.writeFileSync(
    SAFE_DELETE_PATH,
    [
      '# Safe to Delete — Exact Duplicates (already imported)',
      '# Run scripts/delete-confirmed-duplicates.mjs to delete these',
      '# ONLY files that appear in rename-manifest.csv are included',
      '',
      ...deletablePaths
    ].join('\n'),
    'utf8'
  );

  console.log(`[Audit] Safe-to-delete list: ${deletablePaths.length} files → ${SAFE_DELETE_PATH}`);

  // 8. Calculate savings
  const savingsBytes = safeToDelete
    .filter(e => e.canDelete)
    .reduce((sum, e) => sum + e.remove.size, 0);

  // 9. Write report
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const lines = [];

  lines.push('# VijayaSri Footwear — Image Audit Report');
  lines.push(`> Generated: ${now}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Total images scanned | ${files.length} |`);
  lines.push(`| Total size on disk | ${formatBytes(totalBytes)} |`);
  lines.push(`| Exact duplicate groups | ${exactDupGroups.length} |`);
  lines.push(`| Exact duplicate files (removable) | ${safeToDelete.filter(e => e.canDelete).length} |`);
  lines.push(`| Exact duplicates NOT yet imported (kept) | ${safeToDelete.filter(e => !e.canDelete).length} |`);
  lines.push(`| Near-duplicate pairs (hamming ≤ ${HAMMING_THRESHOLD}) | ${nearDupPairs.length} |`);
  lines.push(`| Potential disk savings | **${formatBytes(savingsBytes)}** |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Exact dup section
  lines.push('## Exact Duplicates (byte-identical)');
  lines.push('');

  if (exactDupGroups.length === 0) {
    lines.push('✅ No exact duplicates found.');
  } else {
    for (const group of exactDupGroups) {
      const sorted = [...group].sort((a, b) => {
        if (b.size !== a.size) return b.size - a.size;
        return a.name.length - b.name.length;
      });
      const keep = sorted[0];
      const dups = sorted.slice(1);

      lines.push(`### Group (${group.length} files, SHA-256: \`${keep.sha.slice(0, 16)}…\`)`);
      lines.push('');
      lines.push(`- ✅ **KEEP**: \`${keep.name}\` (${formatBytes(keep.size)}, imported: ${keep.isImported ? 'yes' : 'no'})`);
      for (const d of dups) {
        const action = d.isImported
          ? '🗑️ **DELETE** (already imported)'
          : '⚠️ **KEEP** (not yet imported — confirm before deleting)';
        lines.push(`- ${action}: \`${d.name}\` (${formatBytes(d.size)})`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  // Near-dup section
  lines.push(`## Near-Duplicates (Hamming distance ≤ ${HAMMING_THRESHOLD})`);
  lines.push('');
  lines.push('> These may be different product angles or re-compressed versions of the same photo.');
  lines.push('> **Do NOT delete near-duplicates without manual visual inspection.**');
  lines.push('');

  if (nearDupPairs.length === 0) {
    lines.push('✅ No near-duplicates found at this threshold.');
  } else {
    lines.push('| File A | File B | Hamming | A imported | B imported |');
    lines.push('|---|---|---|---|---|');
    for (const { a, b, hamming } of nearDupPairs.sort((x, y) => x.hamming - y.hamming)) {
      lines.push(`| \`${a.name}\` (${formatBytes(a.size)}) | \`${b.name}\` (${formatBytes(b.size)}) | ${hamming} | ${a.isImported ? 'yes' : 'no'} | ${b.isImported ? 'yes' : 'no'} |`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## All Files (Import Status)');
  lines.push('');
  lines.push('| Filename | Size | Imported? |');
  lines.push('|---|---|---|');
  for (const f of fileData) {
    lines.push(`| \`${f.name}\` | ${formatBytes(f.size)} | ${f.isImported ? '✅ yes' : '⏳ pending'} |`);
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');

  console.log(`[Audit] Report written → ${REPORT_PATH}`);
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  DONE`);
  console.log(`  Exact dup groups:    ${exactDupGroups.length}`);
  console.log(`  Near-dup pairs:      ${nearDupPairs.length}`);
  console.log(`  Safe to delete:      ${deletablePaths.length} files (${formatBytes(savingsBytes)})`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('Next step: review sleppers/duplicates-report.md');
  console.log('Then run:  node scripts/delete-confirmed-duplicates.mjs');
}

main().catch(err => {
  console.error('[Audit] Fatal error:', err);
  process.exit(1);
});
