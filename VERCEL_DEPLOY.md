# Vercel — Free, No Card, No CPU Quota — winlator-frost.vercel.app

**You chose Vercel Hobby (free, no credit card, no CPU quota like HF).** Your `winlator-frost.pages.dev` is Cloudflare Pages — Vercel gives `winlator-frost.vercel.app` free with same code. Both are free, pick one as primary.

## Why Vercel for This Project

- **Free Hobby:** No credit card, `100GB` bandwidth, `6000` build mins, unlimited, custom domain `winlator-frost.vercel.app` free + SSL.
- **Next.js Native:** Made by Vercel, `next.config.ts:10` now `output: "standalone"` off for `VERCEL=1`, handles `app/api` + `proxy.ts` Edge correctly (no `Node.js middleware` error like Pages).
- **File Host Note:** Vercel filesystem is **ephemeral** (`/tmp` only, `uploads/` vanishes on redeploy). Your `5GB` self-hosted `uploads/releases/` (`app/api/admin/releases/upload/route.ts:18` `busboy` + `/api/downloads/[version]` Range) will **not persist** on Vercel. Use the **`External APK URL` field** you already have (`app/admin/(dashboard)/releases/new/page.tsx:381`) for 239 MB+ on Vercel — paste direct link (R2, Backblaze, or even HF `https://kal-tanakorn-winlator-frost.hf.space/uploads/...` after you push there). News stays on Supabase (unchanged).

## Deploy in 2 min (PowerShell, keep `npm run start` tab open)

### 1. Login (one-time, no card)
```powershell
npx vercel login
# Browser → Continue with GitHub → Authorize Vercel
```

### 2. Deploy (from C:\Users\ilias\Documents\winlator-frost-website)
```powershell
npx vercel --prod
# ? Set up and deploy? Y
# ? Which scope? kal-tanakorn (or your Vercel team)
# ? Link to existing project? N
# ? Project name? winlator-frost
# ? In which directory is your code located? ./
# Vercel will run npm run build (already verified ✓) and deploy
# → https://winlator-frost.vercel.app (or https://winlator-frost-website-xxx.vercel.app) live in 60s
```

**First deploy asks for env vars:** Add when prompted or in Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://xcahjcxoacyxouvkcvcq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_...`

Or via CLI:
```powershell
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste value, then
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod  # redeploy with env
```

### 3. Test on Mobile (as you did with trycloudflare)
Open `https://winlator-frost.vercel.app` on mobile data (incognito) → Homepage, News (Supabase), Downloads. Admin → Create Release → Use **External APK URL** for 239 MB (since Vercel disk is ephemeral, local upload would be lost after redeploy).

### 4. Keep winlator-frost.pages.dev Too (Optional)
You already have `https://winlator-frost.pages.dev` via `wrangler pages deploy` (static homepage). Make it redirect to Vercel:
- Cloudflare Dashboard → Pages → `winlator-frost` → Settings → Redirects → `/*` → `https://winlator-frost.vercel.app/$1` `301`
- Or just use both: `winlator-frost.vercel.app` for app, `winlator-frost.pages.dev` for static mirror.

### 5. Updates
```powershell
# After git push or file change
npx vercel --prod
# Vercel auto-deploys on git push if you connected GitHub: vercel.com → Import Project → winlator-frost-website repo
```

## Cost

| Item | Cost |
|------|------|
| Vercel Hobby | 0 THB, no card |
| winlator-frost.vercel.app | 0 THB, SSL free |
| Supabase news | 0 THB free tier |
| winlator-frost.pages.dev (if kept) | 0 THB |
| Custom domain winlator-frost.co.th later | ~1,190 THB/yr (optional) |

Your PC can be off — Vercel hosts 24/7 free. For 5GB persistent `uploads/` without external URL, keep HF Space (`https://kal-tanakorn-winlator-frost.hf.space` at `/data`) as file host and make Vercel download via `external_url` pointing to HF — hybrid is free and no card.

Need me to run `npx vercel --prod` for you, or do you want to push via GitHub integration?
