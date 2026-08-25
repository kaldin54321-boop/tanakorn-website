#!/bin/bash
# Winlator@Frost - Oracle Cloud Free VPS deployment
# Keeps uploads/ persistent (5GB self-hosted file host) + Supabase news
# Run this ON the Oracle VPS (Ubuntu 22.04)

set -e

echo "=== Winlator@Frost Oracle Deploy ==="

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo "Docker installed. Please re-login and re-run this script."
  exit 0
fi

if ! docker compose version &> /dev/null; then
  echo "Installing docker compose plugin..."
  sudo apt update && sudo apt install -y docker-compose-plugin
fi

# 2. Clone or update project
if [ ! -d "winlator-frost-website" ]; then
  echo "Cloning project..."
  # Replace with your GitHub URL after you push
  # git clone https://github.com/YOUR_USERNAME/winlator-frost-website.git
  # cd winlator-frost-website
  echo "Please upload project via scp:"
  echo "  scp -r winlator-frost-website ubuntu@<VPS_IP>:~/"
  exit 1
fi

cd winlator-frost-website

# 3. Ensure .env.local exists (copy from .env.example)
if [ ! -f ".env.local" ]; then
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "EDIT .env.local and set:"
  echo "  NEXT_PUBLIC_SUPABASE_URL=https://xcahjcxoacyxouvkcvcq.supabase.co"
  echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_..."
  echo "Then re-run this script."
  exit 1
fi

# 4. Ensure uploads persists
mkdir -p uploads/releases uploads/tmp
echo "Uploads dir ready: $(pwd)/uploads"

# 5. Build and run
echo "Building Docker image..."
docker compose up --build -d

echo "Waiting for web..."
sleep 10
docker compose logs --tail=20 web

# 6. Test
echo "Testing http://localhost:3000 ..."
curl -I http://localhost:3000 || echo "Web not ready yet, check logs: docker compose logs web"

echo ""
echo "=== Oracle VPS Ready ==="
echo "Web: http://$(curl -s ifconfig.me):3000 (or http://localhost:3000 on VPS)"
echo "Next: Setup Cloudflare Tunnel for https://winlator-frost.pages.dev (see DEPLOYMENT-ORACLE.md)"
echo "To update after git push: git pull && docker compose up --build -d"
