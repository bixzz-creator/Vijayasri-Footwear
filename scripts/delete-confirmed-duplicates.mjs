/**
 * VijayaSri Footwear — Delete Confirmed Duplicates
 *
 * Reads sleppers/safe-to-delete.txt and deletes listed files.
 *
 * SAFETY RULES:
 *   - Only deletes files explicitly listed in safe-to-delete.txt
 *   - Only deletes files that exist inside the sleppers/ folder
 *   - Refuses to delete any file outside the sleppers/ folder
 *   - Writes a deletion log before deleting anything
 *   - Use --dry-run to preview without deleting
 *
 * Usage:
 *   node scripts/delete-confirmed-duplicates.mjs --dry-run
 *   node scripts/delete-confirmed-duplicates.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const SLEPPERS_FOLDER = path.resolve(path.join(__dirname, '..', 'sleppers'));
const SAFE_DELETE_PATH = path.join(SLEPPERS_FOLDER, 'safe-to-delete.txt');
const DELETION_LOG_PATH = path.join(SLEPPERS_FOLDER, 'deletion-log.txt');

// ─── Safety check ─────────────────────────────────────────────────────────────

function isInsideSleppers(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(path.resolve(SLEPPERS_FOLDER) + path.sep);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  VijayaSri Footwear — Delete Confirmed Duplicates');
  if (dryRun) console.log('  MODE: DRY RUN (no files will be deleted)');
  console.log('═══════════════════════════════════════════════');

  if (!fs.existsSync(SAFE_DELETE_PATH)) {
    console.error(`[Delete] safe-to-delete.txt not found at: ${SAFE_DELETE_PATH}`);
    console.error('[Delete] Run `node scripts/audit-images.mjs` first to generate it.');
    process.exit(1);
  }

  const lines = fs
    .readFileSync(SAFE_DELETE_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith('#'));

  if (lines.length === 0) {
    console.log('[Delete] safe-to-delete.txt is empty — nothing to delete.');
    return;
  }

  console.log(`[Delete] ${lines.length} file(s) listed for deletion:`);
  console.log('');

  const toDelete = [];
  const rejected = [];

  for (const line of lines) {
    const filePath = line.trim();
    if (!filePath) continue;

    // Safety: must be inside sleppers/
    if (!isInsideSleppers(filePath)) {
      console.error(`[Delete] REJECTED (outside sleppers/): ${filePath}`);
      rejected.push({ filePath, reason: 'outside sleppers folder' });
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.log(`[Delete] SKIP (already gone): ${path.basename(filePath)}`);
      continue;
    }

    const stat = fs.statSync(filePath);
    toDelete.push({ filePath, size: stat.size });
    console.log(`  ${dryRun ? '[DRY RUN] Would delete' : 'Will delete'}: ${path.basename(filePath)} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  console.log('');

  if (rejected.length > 0) {
    console.error(`[Delete] ⛔ ${rejected.length} file(s) rejected (outside sleppers/) — check safe-to-delete.txt`);
    process.exit(1);
  }

  if (toDelete.length === 0) {
    console.log('[Delete] Nothing to delete.');
    return;
  }

  const totalBytes = toDelete.reduce((s, f) => s + f.size, 0);
  console.log(`[Delete] Total to free: ${(totalBytes / 1024).toFixed(1)} KB`);

  if (dryRun) {
    console.log('\n[Delete] DRY RUN complete — no files deleted.');
    return;
  }

  // Write deletion log BEFORE deleting
  const logLines = [
    `# VijayaSri Footwear — Deletion Log`,
    `# Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    '',
    ...toDelete.map(f => `DELETED: ${f.filePath} (${f.size} bytes)`),
  ];
  fs.writeFileSync(DELETION_LOG_PATH, logLines.join('\n'), 'utf8');
  console.log(`[Delete] Deletion log written: ${DELETION_LOG_PATH}`);

  // Delete
  let deleted = 0;
  for (const { filePath } of toDelete) {
    try {
      fs.unlinkSync(filePath);
      deleted++;
      console.log(`[Delete] ✓ Deleted: ${path.basename(filePath)}`);
    } catch (err) {
      console.error(`[Delete] ✗ Failed: ${path.basename(filePath)} — ${err.message}`);
    }
  }

  console.log('');
  console.log(`[Delete] Done. ${deleted}/${toDelete.length} files deleted.`);
}

main().catch(err => {
  console.error('[Delete] Fatal error:', err);
  process.exit(1);
});
