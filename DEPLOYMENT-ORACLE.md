# Oracle Free VPS → https://winlator-frost.pages.dev (Permanent, No PC Needed)

This makes `winlator-frost.pages.dev` **permanently online** via Oracle Cloud Free VPS (keeps `uploads/releases/` 5GB self-hosted, separate from Supabase news). Your PC can be off.

> **You chose:** Oracle + free `pages.dev` (0 THB, no `winlator-frost.co.th` purchase). Good — `pages.dev` is free, hosting via Oracle Free is free, SSL free via Cloudflare Tunnel.

---

## 1. Create Oracle Cloud Free VPS (5 min, one-time)

1.  Go https://www.oracle.com/cloud/free/ → Sign Up → Requires credit card (verification only, $0) → Choose **Always Free** region `ap-singapore-1` (closest to Thailand, low latency).
2.  Dashboard → Compute → Create Instance → Name `winlator-frost` → Image `Ubuntu 22.04` → Shape `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM, **Free**) → Add SSH key (paste `C:\Users\ilias\.ssh\oracle_key.pub` or generate `ssh-keygen -t ed25519` in PowerShell) → Create → Note **Public IP** e.g., `152.67.67.67`.
3.  Security → Virtual Cloud Network → Security Lists → Add Ingress Rule: `Source 0.0.0.0/0`, `TCP 22,80,443` (for SSH + HTTP).

## 2. Upload Project to VPS (2 min)

On **this Windows PC** (PowerShell):

```powershell
# Edit .env.example to .env.local first (already done in project)
# Upload via script (replace IP and key path)
.\scripts\deploy-oracle.ps1 -VpsIp "152.67.67.67" -SshKey "$env:USERPROFILE\.ssh\oracle_key"
# Or manually:
scp -r -i $env:USERPROFILE\.ssh\oracle_key winlator-frost-website ubuntu@152.67.67.67:~/
scp -i $env:USERPROFILE\.ssh\oracle_key .env.local ubuntu@152.67.67.67:~/winlator-frost-website/.env.local
```

## 3. Build & Run on Oracle (3 min)

SSH to VPS:
```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_key ubuntu@152.67.67.67
cd ~/winlator-frost-website
chmod +x scripts/deploy-oracle.sh
./scripts/deploy-oracle.sh
# Script does: apt Docker, mkdir -p uploads/releases uploads/tmp, docker compose up --build -d
docker compose logs -f web  # wait for "Ready on http://0.0.0.0:3000"
curl -I http://localhost:3000  # should be 200
```

Verify persistent: `ls -lh uploads/releases/` should still have `11.10/app-debug.apk` after `docker compose restart`.

## 4. Make it `https://winlator-frost.pages.dev` Free (3 min)

**Option 4A — Cloudflare Tunnel (recommended, keeps Oracle IP hidden, free SSL):**

On **Oracle VPS** (still SSH):
```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Login (if VPS has browser, use token method instead)
# On your PC, run: cloudflared tunnel login -> copy token, or create via dashboard
# Easier: create tunnel via Cloudflare Dashboard → Zero Trust → Networks → Tunnels → Create → Copy Token

# Create tunnel (run on VPS if you have browser, or do on PC and copy credentials)
cloudflared tunnel create winlator-frost
cloudflared tunnel route dns winlator-frost winlator-frost.pages.dev
# If winlator-frost.pages.dev is taken (Pages reserves it), use Tunnel with custom domain:
# cloudflared tunnel route dns winlator-frost winlator-frost.yourdomain.com
# For free pages.dev, better to use Cloudflare Pages directly (Option 4B)
```

**Option 4B — Cloudflare Pages Free Domain (simplest for `pages.dev`):**

Since `winlator-frost.pages.dev` is a **Pages** domain (not Tunnel), do:

```powershell
# On this PC (after pushing to GitHub)
npx wrangler login
npx wrangler pages project create winlator-frost --production-branch main
# Connect GitHub repo: Cloudflare Dashboard → Pages → Create → Connect to Git → winlator-frost-website → Build: npm run build, Output: .next
# Or deploy via CLI:
npm run build
npx wrangler pages deploy .next --project-name=winlator-frost
# → Gives https://winlator-frost.pages.dev free
```

**Warning for 4B:** Pages has **no persistent disk** — your `uploads/` would be lost. So for 4B you must migrate releases to **R2** (10 GB free). Edit `wrangler.toml:8` to add `[[r2_buckets]] binding = "RELEASES_BUCKET" bucket_name = "winlator-releases"` and update `app/api/admin/releases/upload/route.ts` to use `S3Client` with `R2_ENDPOINT`. For now, **use 4A (Oracle + Tunnel)** to keep your current `uploads/` self-hosted logic unchanged.

**Recommended for you:** Use **Oracle VPS + Tunnel** and expose as `https://winlator-frost.pages.dev` is actually not directly via Tunnel — instead, create a **CNAME** `winlator-frost.pages.dev` is auto-assigned by Pages, not Tunnel. For Oracle, you will get `https://winlator-frost-<random>.trycloudflare.com` free instantly, or if you own `winlator-frost.co.th` later, Tunnel can serve it. For now, your permanent free URL will be `https://<your-vps-ip>` via Tunnel's `https://winlator-frost-<uuid>.cfargotunnel.com` which you can alias to `winlator-frost.pages.dev` via Cloudflare Dashboard → DNS → CNAME.

**Simplest to get `winlator-frost.pages.dev` today:**
1.  Push code to GitHub: `git init; git add .; git commit -m "feat: self-hosted 5GB"; git remote add origin https://github.com/YOUR_USER/winlator-frost-website.git; git push -u origin main`
2.  Cloudflare Dashboard → Pages → Create project → Connect GitHub → Select `winlator-frost-website` → Framework: Next.js → Env vars: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → Deploy → **You get `https://winlator-frost.pages.dev` in 2 min.**

Then for Oracle persistence, keep `uploads/` on Oracle and set `R2` as above if you want Pages to serve APKs, or just use Oracle's `https://winlator-frost.pages.dev` via Tunnel is actually `https://tunnel-id.cfargotunnel.com` — you can make Pages just redirect to Oracle.

## 5. Test on Mobile (as you did with trycloudflare)

- Open `https://winlator-frost.pages.dev` on mobile data (incognito) → Homepage, News (Supabase), Downloads → `11.10` → Download APK → should stream with `206 Partial Content` from `uploads/`.
- Upload test: Admin → Releases → Upload 239 MB → progress bar → `uploads/releases/{version}/` on VPS → `ls -lh` to verify.

## 6. Keep Online Without This PC

- Oracle VPS `docker compose` is `restart: unless-stopped` → survives reboot.
- Tunnel as systemd: `sudo cloudflared service install` + `sudo systemctl enable --now cloudflared`
- This PC can be off — VPS serves.

---

### Quick Copy-Paste for Oracle (after SSH)

```bash
cd ~/winlator-frost-website
cat .env.local  # verify SUPABASE vars
docker compose up --build -d && docker compose logs -f
# In new SSH tab:
cloudflared tunnel --url http://localhost:3000  # for instant test, gives https://*.trycloudflare.com
```

For permanent `winlator-frost.pages.dev`, use Pages Dashboard as above or tell me your Oracle IP and I’ll generate the exact `wrangler pages deploy` command.
