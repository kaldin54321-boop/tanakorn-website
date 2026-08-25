# Winlator@Frost - Oracle VPS deploy helper (run from Windows to upload to VPS)
# Usage: .\scripts\deploy-oracle.ps1 -VpsIp "152.67.67.67" -SshKey "C:\Users\ilias\.ssh\oracle_key"

param(
  [Parameter(Mandatory=$true)] [string]$VpsIp,
  [string]$SshKey = "$env:USERPROFILE\.ssh\id_rsa",
  [string]$User = "ubuntu"
)

Write-Host "=== Winlator@Frost → Oracle VPS ===" -ForegroundColor Cyan

# 1. Test SSH
Write-Host "Testing SSH to $User@$VpsIp..."
ssh -i $SshKey -o StrictHostKeyChecking=accept-new "$User@$VpsIp" "echo connected; uname -a"

# 2. Upload project (excluding node_modules, .next)
Write-Host "Uploading project via scp..."
# Use tar to exclude big dirs
$exclude = @("node_modules",".next",".git","uploads/tmp")
# Simple scp -r (ensure uploads folder exists on VPS, but don't overwrite existing APKs)
scp -r -i $SshKey -o StrictHostKeyChecking=accept-new `
  -r "C:\Users\ilias\Documents\winlator-frost-website\Dockerfile" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\docker-compose.yml" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\package.json" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\package-lock.json" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\next.config.ts" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\app" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\lib" `
  -r "C:\Users\ilias\Documents\winlator-frost-website\public" `
  "$User@${VpsIp}:~/winlator-frost-website/"

# Upload .env.local separately
scp -i $SshKey ".env.local" "$User@${VpsIp}:~/winlator-frost-website/.env.local"

Write-Host "Uploaded. Now SSH to VPS and run:"
Write-Host "  ssh -i $SshKey $User@$VpsIp"
Write-Host "  cd winlator-frost-website && chmod +x scripts/deploy-oracle.sh && ./scripts/deploy-oracle.sh"
Write-Host "Or run remotely:"
ssh -i $SshKey "$User@$VpsIp" "cd ~/winlator-frost-website && chmod +x scripts/deploy-oracle.sh && ./scripts/deploy-oracle.sh"
