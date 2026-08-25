# Render Docker — Free, No Card, No 100 MB Limit

**Why Render fixes Vercel's `File size limit exceeded (100 MB)`:** Vercel bundles your local `uploads/releases/11.10/app-debug.apk` (235 MB) into the deployment. Render with `runtime: docker` builds a Docker image (no 100 MB per-file limit) and streams uploads via `busboy` (5GB).

**Your setup:** `render.yaml:6` `runtime: docker` + `Dockerfile:1` (multi-stage, `output: "standalone"`, `PORT` auto) + `app/api/admin/releases/upload/route.ts:18` (local `uploads/releases/{version}/` with `Range` support). News stays on Supabase (`NEXT_PUBLIC_SUPABASE_*`).

## Deploy in 3 min (Free, No Credit Card)

### 1. Push to GitHub (if not already)
```powershell
git add .
git commit -m "feat: Render Docker"
git push origin main
# If you haven't pushed winlator-frost-website to GitHub yet:
# gh repo create winlator-frost-website --public --source=.
# git remote add origin https://github.com/kal-tanakorn/winlator-frost-website.git
# git push -u origin main
```

### 2. Create Render Service (Free)
1. Go https://dashboard.render.com → **New +** → **Web Service** → Connect `kal-tanakorn/winlator-frost-website` repo.
2. Render auto-detects `render.yaml` + `Dockerfile` → Shows:
   - **Name:** `winlator-frost`
   - **Runtime:** `Docker`
   - **Plan:** `Free` (750 hrs/mo, 512MB RAM, 0.1 CPU, 100GB bandwidth, sleeps 15 min → 30s cold start, no card)
   - **Build:** `Docker` (uses your `Dockerfile`)
   - **Health Check:** `/`
3. **Environment → Add:**
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xcahjcxoacyxouvkcvcq.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_...` (from `.env.local`)
   - (Optional for bucket fix API) `SUPABASE_SERVICE_ROLE_KEY` = `eyJ...` (only if you want auto `fix-bucket`, not needed)
4. Click **Create Web Service** → Deploy starts (4-6 min, Docker build `npm ci` + `npm run build`).

### 3. Get Free Domain
- Render gives `https://winlator-frost.onrender.com` free + SSL instantly.
- Test on mobile: `https://winlator-frost.onrender.com` → Homepage, News (Supabase), Downloads. Admin → Upload 239 MB APK → `Self-hosted (5GB)` → stored at `/app/uploads/releases/` on Render (ephemeral on Free).

### 4. File Host Note (5GB on Render Free)

- **Render Free disk is ephemeral** — `uploads/` vanishes on restart/redeploy. Your current `235 MB` APK would be lost after each deploy (same as Vercel).
- **For `winlator-frost.onrender.com` Free, use `External APK URL` field** (`app/admin/(dashboard)/releases/new/page.tsx:381`) for 239 MB+ — paste direct link (e.g., `https://...r2.dev/...` or even `https://kal-tanakorn-winlator-frost.hf.space/uploads/...` if you keep HF as file host). This is free, no card, and persists (Supabase `releases.external_url` column, already in `lib/releases.ts:26`).
- **To make `uploads/` persistent on Render:** Upgrade to **Starter $7/mo** → `render.yaml:19` uncomment `disk:` (10GB, `mountPath: /app/uploads`). Then local `uploads/` survives.

### 5. Updates
```powershell
# After local change
git add .; git commit -m "update"; git push
# Render auto-deploys (autoDeploy: true in render.yaml)
```

### 6. Custom Domain (Optional, Still Free Hosting)
- Render Dashboard → `winlator-frost` → **Settings** → **Custom Domains** → Add `winlator-frost.pages.dev` is Cloudflare Pages, not Render — for Render, add `winlator-frost.com` (if you buy ~$12/yr) → Cloudflare → CNAME to `winlator-frost.onrender.com` → free SSL.

## Cost

| Item | Cost |
|------|------|
| Render Free | 0 THB, no card, 750 hrs (enough for 1 app 24/7 with 15 min sleep) |
| winlator-frost.onrender.com | 0 THB, SSL free |
| Supabase news | 0 THB free tier |
| winlator-frost.pages.dev (if kept) | 0 THB, redirect to Render or keep static |
| Persistent 10GB disk | $7/mo Starter (or use External URL free) |

**Quick test without Render:** Your `.vercelignore` fix already makes `npx vercel --prod` succeed now (235 MB excluded) → `https://winlator-frost.vercel.app` free. But Render Docker has **no 100 MB limit at all**, so it's cleaner for 5GB.

Want me to push to GitHub and trigger Render now, or keep Vercel with `.vercelignore` as primary?
