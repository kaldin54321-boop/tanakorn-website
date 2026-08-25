# Deploy to Vercel Hobby (Free, No Card, No Quota) - winlator-frost.vercel.app
# Usage: .\scripts\deploy-vercel.ps1

$ErrorActionPreference = "Stop"
Write-Host "=== Winlator@Frost → Vercel ===" -ForegroundColor Cyan

# Check login
Write-Host "Checking Vercel login..."
try { & npx vercel whoami 2>&1 | Out-Null; $logged = $LASTEXITCODE -eq 0 } catch { $logged = $false }
if (-not $logged) {
  Write-Host "Not logged in. Running vercel login..." -ForegroundColor Yellow
  & npx vercel login
}

Write-Host "Deploying to production..."
& npx vercel --prod

Write-Host "Done! Check https://winlator-frost.vercel.app (or the URL shown above)" -ForegroundColor Green
Write-Host "If first deploy, add env vars in Vercel Dashboard → Settings → Environment Variables:"
Write-Host "  NEXT_PUBLIC_SUPABASE_URL"
Write-Host "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
Write-Host "Then redeploy: npx vercel --prod"
