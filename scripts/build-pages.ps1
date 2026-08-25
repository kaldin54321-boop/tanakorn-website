# Build for Cloudflare Pages static (winlator-frost.pages.dev) - homepage only
# API routes (uploads) stay on HF/Oracle self-hosted, so Pages static is fine

$ErrorActionPreference = "Stop"
Write-Host "=== Building for Cloudflare Pages (static) ===" -ForegroundColor Cyan

# Backup API routes and proxy (not supported with output: export)
if (Test-Path "app\api") {
  Move-Item "app\api" "app\api.bak" -Force
  Write-Host "Moved app/api -> app/api.bak for static export"
}
if (Test-Path "proxy.ts") {
  Move-Item "proxy.ts" "proxy.ts.bak" -Force
  Write-Host "Moved proxy.ts for static export"
}

$env:CF_PAGES = "1"
try {
  & "C:\Program Files\nodejs\npm.cmd" run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed" }
  Write-Host "Build OK, out/ created" -ForegroundColor Green
  Get-ChildItem "out" | Select-Object -First 10 | Format-Table Name, Length
} finally {
  Remove-Item Env:\CF_PAGES -ErrorAction SilentlyContinue
  if (Test-Path "app\api.bak") {
    Move-Item "app\api.bak" "app\api" -Force
    Write-Host "Restored app/api"
  }
  if (Test-Path "proxy.ts.bak") {
    Move-Item "proxy.ts.bak" "proxy.ts" -Force
    Write-Host "Restored proxy.ts"
  }
}

Write-Host "Done. Deploy with: npx wrangler pages deploy out --project-name=winlator-frost --branch=main" -ForegroundColor Green
