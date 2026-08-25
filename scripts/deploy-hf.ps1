# Deploy to Hugging Face Spaces (Free, No Credit Card, Persistent /data for 5GB APKs)
# Usage: .\scripts\deploy-hf.ps1 -Username "YOUR_HF_USERNAME" -SpaceName "winlator-frost"

param(
  [Parameter(Mandatory=$true)][string]$Username,
  [string]$SpaceName = "winlator-frost",
  [string]$ProjectPath = "C:\Users\ilias\Documents\winlator-frost-website"
)

$ErrorActionPreference = "Stop"
Write-Host "=== Winlator@Frost → Hugging Face Spaces ===" -ForegroundColor Cyan

# No pip/huggingface-cli needed - uses git + HF token only (works without Python)
# Get HF token from https://huggingface.co/settings/tokens → Create New → Type: Write → Copy

$SpaceId = "$Username/$SpaceName"
$RemoteUrl = "https://huggingface.co/spaces/$SpaceId"

Write-Host "Target Space: $RemoteUrl" -ForegroundColor Green
Write-Host "You need a HF Write token from https://huggingface.co/settings/tokens" -ForegroundColor Yellow
# Token will be used as git password when pushing - no huggingface-cli needed

# Create Space if not exists - do it via web UI: https://huggingface.co/new-space
# Choose SDK: Docker -> Blank, Hardware: CPU basic (free). If already created, skip.

# Prepare temp clone
$TempDir = Join-Path $env:TEMP "hf-$SpaceName"
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
git clone $RemoteUrl $TempDir
if ($LASTEXITCODE -ne 0) {
  Write-Host "Clone failed - check Space exists and you have write access" -ForegroundColor Red
  exit 1
}

Write-Host "Copying project to $TempDir..."
# Copy all files except node_modules, .next, .git, uploads/tmp (keep uploads structure)
$exclude = @("node_modules",".next",".git","uploads\tmp")
Copy-Item -Path "$ProjectPath\*" -Destination $TempDir -Recurse -Force -Exclude $exclude
Copy-Item -Path "$ProjectPath\.env.local" -Destination (Join-Path $TempDir ".env.local") -Force -ErrorAction SilentlyContinue
Copy-Item -Path "$ProjectPath\README_HF.md" -Destination (Join-Path $TempDir "README.md") -Force -ErrorAction SilentlyContinue

Set-Location $TempDir
git add .
$commitMsg = "feat: deploy Winlator Frost $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $commitMsg
git push

Write-Host "Pushed to $RemoteUrl" -ForegroundColor Green
Write-Host "Space will build Docker (3-5 min). Watch at: $RemoteUrl" -ForegroundColor Cyan
Write-Host "After build, add env vars: Space → Settings → Variables → NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
Write-Host "Then test on mobile: https://$Username-$SpaceName.hf.space"
Write-Host "For winlator-frost.pages.dev free: Cloudflare Pages → Connect same GitHub or wrangler pages deploy"

Set-Location $ProjectPath
