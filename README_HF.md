---
title: Winlator Frost
emoji: ❄️
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
app_port: 7860
---

# Winlator@Frost — Hugging Face Spaces (Free, No Credit Card)

**Self-hosted file host (releases 5GB) + Supabase news**

This Space hosts `winlator-frost.pages.dev` permanently without this PC.

- **Releases:** Self-hosted `uploads/releases/` via Docker volume `/data/uploads` (HF persistent, 50GB free, no credit card) — 5GB APKs, resumable Range downloads.
- **News:** Supabase `https://xcahjcxoacyxouvkcvcq.supabase.co` (unchanged).

## Quick Deploy (No Credit Card, 2 min)

1. Create HF account https://huggingface.co/join (no card)
2. New Space → Name `winlator-frost` → SDK `Docker` → Hardware `CPU basic` (free, 16GB RAM, 2 vCPU) → Public → Create
3. Upload this project (or `git push`):
```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/winlator-frost
cp -r winlator-frost-website/* winlator-frost/
cd winlator-frost
git add .
git commit -m "feat: HF Space"
git push
```
4. Add env vars: Space → Settings → Variables → Add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from `.env.local`)
5. Space builds Docker automatically → Live at `https://YOUR_USERNAME-winlator-frost.hf.space` free + SSL free

To get `winlator-frost.pages.dev` free (optional):
- Cloudflare Dashboard → Pages → Create → Connect same GitHub repo → Build `npm run build` → Auto `https://winlator-frost.pages.dev`

See `DEPLOYMENT-HF.md` for full steps + Oracle alternative.
