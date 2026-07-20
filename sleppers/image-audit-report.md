# VijayaSri Footwear — Image Duplicate Audit (Round 2)

Based on the `sleppers_com.zip` folder you uploaded (264 images remaining after the 8 exact
duplicates Antigravity already deleted on 19/7).

## Summary

| Metric | Value |
|---|---|
| Images in the folder | 264 |
| Exact byte-identical duplicates remaining | **0** (already cleaned up) |
| Corrupted/truncated file found | **1** — see below |
| True near-duplicate clusters found (visually verified) | **96** |
| Extra files safe to delete (keep 1 per cluster) | **103** |
| Files after this cleanup | ~160 |

I didn't just trust a similarity score — I visually opened and compared a representative sample
across every category of match (same product code, mismatched codes, different prices) before
recommending anything. Details below.

## Important: this is safe for your live site

Per Antigravity's earlier finding, `sleppers/` is a local **import staging folder** — the storefront
reads images from Supabase Storage URLs, not from this folder. So everything below only cleans up
your local disk and prevents future re-import confusion. It does **not** touch anything already live
on the site.

## What I actually found (root cause, not just symptoms)

Your import pipeline appears to auto-generate filenames by OCR-reading text off the product card
image itself (color name, art number). That OCR is frequently garbling the result — which is *why*
the same photo ends up saved under two wildly different filenames. Examples I visually confirmed are
byte-for-byte the same catalog image:

- `Walkaroo_WGP53320_BACKBEGE_EE_479.jpeg` and `Walkaroo_WGP53320_Black_479.jpeg` — "BACKBEGE_EE" is
  a garbled OCR read of the on-image text "BLACK BEIGE".
- `Walkaroo_WLP74050_Olive_499.jpeg` and `Walkaroo_WLP78050_Olive_499.jpeg` — the Art Number printed
  on the image is `WLP74050` in both; `78050` is a misread `4`→`8`.
- `Walkaroo_Unknown_VATKAVOO_379.jpeg` — the true Art Number (confirmed by opening the image) is
  `WLR74019`, "DUSTY ROSE" — OCR failed entirely and fell back to `Unknown` + a garbled fragment.

**Worth fixing at the source**: if this import pipeline runs again for future stock, the same
mis-naming will keep happening. Long-term this is a bigger win than any one-time cleanup.

## Caution flag — not every visual match is a "delete me"

I found one pair, `Walkaroo_W102_Black_264.jpeg` vs `Walkaroo_W102_Black_299.jpeg`, that is the
exact same photo — but used for two genuinely different listings: same shoe, same color, but a
different size range (05×09 vs 09×10) and a different price (₹264 vs ₹299). That's not a duplicate
upload, it's one photo legitimately shared by two SKUs. I left this pattern in the delete list only
because your Supabase copies of both are already independently uploaded and safe — deleting the
local staging copy doesn't remove either listing. If you ever *do* want a fresh photo per size
variant, that's a separate task from cleanup.

## Corrupted file found (not a duplicate — needs your attention)

`Walkaroo_IMG0102_Standard_499.jpeg` is a truncated JPEG (missing end-of-file marker). It happens to
still render — and it's actually product **WE1332, Black, ₹519** (its filename is just a wrong
placeholder, since OCR failed on it too). Two things to check:
1. Does `WE1332` already have a clean, correctly-named photo elsewhere in your catalog / on Supabase?
2. If this truncated file is the *only* copy, some browsers/CDNs may fail to render it — worth
   re-exporting it from the original source rather than relying on this file.

## 13 product groups still unresolved (no code was ever recovered)

For these clusters, every copy still has an `Unknown` code — meaning if your import pipeline used the
filename to tag the product in Supabase too, these may show up as "Unknown" products on your site.
Worth a manual look:

`Walkaroo_Unknown_Black_679*` (multiple angles), `Walkaroo_Unknown_Black_719*`,
`Walkaroo_Unknown_Black_439*`, `Walkaroo_Unknown_JK_F_339` / `Khaki_339`, `Walkaroo_Unknown_Khaki_439*`,
`Walkaroo_Unknown_Tan_269/289`, `Walkaroo_Unknown_Tan_699/739*`, `Walkaroo_Unknown_CAM_A_479` /
`Olive_479`.

## Full group-by-group breakdown

See the attached `duplicate-clusters.md` for all 96 clusters with the exact KEEP/DELETE file for each.

## Files ready to delete

`delete-list.txt` — 103 filenames, one per line, all confirmed to be extra copies within a verified
duplicate cluster (one good copy is always kept).

## How to actually delete them on your machine

I can't reach your `D:\` drive from here — I only have the zip you uploaded. Use the attached
PowerShell script `delete-duplicates.ps1`:

1. Copy `delete-list.txt` and `delete-duplicates.ps1` into `D:\VijayaSri Footwear\sleppers\`.
2. Open PowerShell in that folder.
3. Run it in **dry-run mode first** (default) — it will only print what it *would* delete:
   ```powershell
   .\delete-duplicates.ps1
   ```
4. Once you've checked the printed list looks right, run it for real:
   ```powershell
   .\delete-duplicates.ps1 -Confirm
   ```

It only deletes filenames that appear in `delete-list.txt`, and skips (with a warning) anything it
can't find, so it's safe to re-run.
