# Winlator@Frost — Make it Official: winlator-frost.co.th (Free Hosting)

Your site is `http://localhost:3000` now (only this PC). To make `https://winlator-frost.co.th` visible to everyone **free-of-charge for hosting/SSL**, follow this guide.

> **Truth about domain cost:** `winlator-frost.co.th` **is not free**. `.co.th` requires THNIC registration + Thai company docs + ~1,190 THB/year (~$33). Hosting + SSL + Tunnel can be 100% free, but the domain name itself is like rent — you must pay the registrar yearly. There is **no free `.co.th`**. If you want truly 0 THB, use a free subdomain `winlator-frost.pages.dev` / `vercel.app` (see Option C). Below shows how to keep hosting free and domain cost minimal.

---

## Architecture You Have Now (Good for Self-Hosted)

- **Releases (APK 239 MB - 5 GB):** Self-hosted local file host `uploads/releases/{version}/` + `busboy` streaming + Range resumable downloads (`app/api/admin/releases/upload/route.ts:1`, `app/api/downloads/[version]/route.ts:1`). **Keeps working only if server disk persists.** Vercel free would *delete* uploads on redeploy — so for self-hosted APKs you must host on your own PC/VPS with persistent volume (Docker `volumes: ./uploads:/app/uploads`).
- **News:** Supabase (`https://xcahjcxoacyxouvkcvcq.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local:2`) — stays as-is, free tier is fine for news.

---

## Option A — Recommended: Stay Self-Hosted + Cloudflare Tunnel (FREE, keeps 247 MB APK)

Best for you: your PC *is* the file host, no upload loss, no Vercel 50 MB limit, no subscription.

### 1. Buy Domain (one-time yearly fee, only cost)
- **.co.th:** Go to https://www.thnic.co.th → Search `winlator-frost.co.th` → Register with company docs. Or use cheaper registrar: Namecheap, Cloudflare Registrar (~$12/yr for `.com` if you can accept `winlator-frost.com` instead — no docs needed). For `.co.th` you *must* pay THNIC.
- **If you truly want free:** Skip buy, use `winlator-frost.co.th` later, for now deploy to `winlator-frost.pages.dev` (free) — you can add custom domain later when you buy it.

### 2. Put Domain on Cloudflare (Free)
1. Create free Cloudflare account → Add site `winlator-frost.co.th` → Choose Free plan.
2. Cloudflare gives you 2 nameservers `*.ns.cloudflare.com` → Go to THNIC/domain registrar → Change nameservers to Cloudflare's.
3. Wait 5 min - 24 h for DNS.

### 3. Install Cloudflare Tunnel (Free, no port forward, no public IP)
On your PC (where `npm run dev` runs):

```powershell
# Windows (PowerShell)
winget install --id Cloudflare.cloudflared
cloudflared --version

# Login (opens browser)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create winlator-frost

# Route domain to tunnel (Cloudflare will create DNS CNAME automatically, free)
cloudflared tunnel route dns winlator-frost winlator-frost.co.th
cloudflared tunnel route dns winlator-frost www.winlator-frost.co.th
```

This creates `C:\Users\ilias\.cloudflared\config.yml` and credentials. **Copy the Tunnel Token** from `cloudflared tunnel token winlator-frost`.

### 4. Build & Run Production (Self-Hosted)

```powershell
# In C:\Users\ilias\Documents\winlator-frost-website
npm run build
# Test prod locally
npm run start
# Open http://localhost:3000 — should work
```

Or via Docker (keeps `uploads/` persistent):

```powershell
docker compose up --build -d
# Check logs
docker compose logs -f web
```

### 5. Expose via Tunnel (Free HTTPS)

Create `C:\Users\ilias\.cloudflared\config.yml`:

```yaml
tunnel: winlator-frost
credentials-file: C:\Users\ilias\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: winlator-frost.co.th
    service: http://localhost:3000
  - hostname: www.winlator-frost.co.th
    service: http://localhost:3000
  - service: http_status:404
```

Run:

```powershell
cloudflared tunnel run winlator-frost
# Or with token (for docker-compose tunnel service):
# Set TUNNEL_TOKEN in .env.local then docker compose up
```

Visit `https://winlator-frost.co.th` — your PC serves it with **free Cloudflare SSL (HTTPS)**, no subscription. Keep PC on, or move to a free VPS (see below).

### 6. Keep Uploads Persistent
- `uploads/releases/` is already gitignored (`.gitignore:44`) and mounted as Docker volume ` - ./uploads:/app/uploads` (`docker-compose.yml:14`). **Do not delete** this folder. Back it up.
- Self-hosted has no 50 MB limit — TUS replaced by local `busboy` 5 GB streaming.

---

## Option B — Free VPS (if you don't want to keep PC on 24/7)

Host Docker on a free VPS (still free + keeps disk):

- **Oracle Cloud Free:** 2 AMD VMs forever, 200 GB disk — run `docker compose up` there.
- **Fly.io Free:** `fly launch` → `fly volumes create uploads --size 10` → `fly deploy` (free allowance).
- **Railway / Render Free:** Similar, but uploads need external R2/S3 (ephemeral disk). Prefer Oracle/Fly for persistent `uploads/`.

Steps same as Option A then `cloudflared tunnel` on VPS.

---

## Option C — Truly Free Without Buying .co.th (0 THB)

If you cannot pay THNIC, deploy to free subdomain *today* and add custom domain later:

- **Cloudflare Pages (Free):** `npm run build` → `npx wrangler pages deploy .next/standalone` or connect GitHub → Pages will give `https://winlator-frost.pages.dev` free + SSL free.
- **Vercel Hobby (Free):** `npx vercel --prod` → gives `https://winlator-frost-website.vercel.app` free. **Warning:** Vercel filesystem is ephemeral — your `uploads/releases/11.10/app-debug.apk` (247 MB) would be lost on redeploy. For Vercel you must switch releases to R2/S3, not local. So for your self-hosted APK host, **do not use Vercel** — use Option A/B.

---

## Checklist Before Going Public

- [ ] `npm run build` succeeds (standalone output enabled `next.config.ts:9`)
- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on server (copy to VPS)
- [ ] `uploads/releases/11.10/app-debug.apk` backed up (247 MB)
- [ ] Domain bought (or using free `*.pages.dev` temporarily)
- [ ] Cloudflare Tunnel running (`cloudflared tunnel run`)
- [ ] Test `https://winlator-frost.co.th` incognito + mobile data
- [ ] Supabase news still works (no change)

## Cost Summary (Free Hosting)

| Item | Cost | Free? |
|------|------|-------|
| Hosting (Cloudflare Tunnel + your PC/VPS) | 0 THB | ✅ Free |
| SSL (Cloudflare / Let's Encrypt) | 0 THB | ✅ Free |
| Next.js / Supabase news | 0 THB | ✅ Free (Supabase free tier) |
| **Domain winlator-frost.co.th** | **~1,190 THB/year** | **❌ Not free — registrar fee** |
| Alternative free domain `winlator-frost.pages.dev` | 0 THB | ✅ Free |

You cannot make `.co.th` free — you can make *everything else* free. If budget is 0 THB, start with `pages.dev` then add `winlator-frost.co.th` when you buy it — code is ready (`next.config.ts` already allows custom domain, no code change needed).

## Quick Start (Copy-Paste for Your PC Now)

```powershell
npm run build
npm run start
# In another terminal:
cloudflared tunnel --url http://localhost:3000
# Cloudflare will give you a free https://*.trycloudflare.com URL instantly to test sharing before DNS is ready
```

That `trycloudflare.com` URL is 100% free and instantly public — use it to test with friends before `winlator-frost.co.th` DNS propagates.
