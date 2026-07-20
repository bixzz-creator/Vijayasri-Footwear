# delete-duplicates.ps1
# Deletes duplicate image files listed in delete-list.txt from the current folder.
# Run WITHOUT -Confirm first to see a dry-run of what would happen.
#
# Usage:
#   .\delete-duplicates.ps1              # dry run - lists what would be deleted
#   .\delete-duplicates.ps1 -Confirm     # actually deletes the files

param(
    [switch]$Confirm
)

$listFile = "delete-list.txt"

if (-not (Test-Path $listFile)) {
    Write-Host "ERROR: $listFile not found in the current folder." -ForegroundColor Red
    Write-Host "Copy delete-list.txt into the same folder as this script and try again."
    exit 1
}

$files = Get-Content $listFile | Where-Object { $_.Trim() -ne "" }

$found = @()
$missing = @()

foreach ($f in $files) {
    if (Test-Path $f) {
        $found += $f
    } else {
        $missing += $f
    }
}

Write-Host "Duplicate deletion plan" -ForegroundColor Cyan
Write-Host "------------------------"
Write-Host "Files listed:      $($files.Count)"
Write-Host "Found on disk:     $($found.Count)"
Write-Host "Already missing:   $($missing.Count)"
Write-Host ""

if ($missing.Count -gt 0) {
    Write-Host "The following listed files were not found (already deleted or moved):" -ForegroundColor Yellow
    $missing | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
}

if (-not $Confirm) {
    Write-Host "DRY RUN - no files were deleted. Files that WOULD be deleted:" -ForegroundColor Yellow
    $found | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "Re-run with -Confirm to actually delete these $($found.Count) files." -ForegroundColor Green
} else {
    Write-Host "Deleting $($found.Count) files..." -ForegroundColor Red
    $deleted = 0
    foreach ($f in $found) {
        try {
            Remove-Item -LiteralPath $f -Force
            $deleted++
        } catch {
            Write-Host "  FAILED to delete: $f - $_" -ForegroundColor Red
        }
    }
    Write-Host ""
    Write-Host "Done. Deleted $deleted of $($found.Count) files." -ForegroundColor Green
}
