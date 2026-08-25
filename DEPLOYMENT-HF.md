# Hugging Face Spaces — Permanent Free Hosting (No Credit Card, No PC)

**You chose Hugging Face Spaces** (free, 16GB RAM, 2 vCPU, 50GB persistent at `/data`, no credit card) for `winlator-frost.pages.dev` so your PC can be off. Releases stay self-hosted (`/data/uploads/releases`).

## Why HF Spaces for This Project

- **Free & no card:** Sign up with email/GitHub only (unlike Oracle which rejected your card).
- **Persistent 50GB:** Docker Spaces persist at `/data` — your 247 MB APK survives restarts (Vercel/Pages would delete `uploads/`).
- **Docker native:** Your `Dockerfile:1` already `output:"standalone"` + `PORT=7860` (HF expects 7860, we support both 3000/7860).
- **Free domain:** `https://YOUR_USERNAME-winlator-frost.hf.space` instantly free + SSL. `winlator-frost.pages.dev` can be added later via Cloudflare CNAME with no rebuild.

## Steps (2 min, No Credit Card)

### 1. Create Space (Web, No CLI needed)
1. Go https://huggingface.co/join → Sign up (email, no card)
2. Top right → New Space → 
   - **Owner:** `YOUR_USERNAME`
   - **Space name:** `winlator-frost`
   - **License:** MIT
   - **SDK:** `Docker` (not Gradio)
   - **Hardware:** `CPU basic` (free, 2 vCPU, 16 GB RAM)
   - **Visibility:** `Public`
   → Create space

### 2. Push Code (PowerShell on this PC, keep `npm run start` tab open is OK)
```powershell
# Install huggingface hub if not present
pip install huggingface_hub  # or pipx install huggingface_hub

# Login (paste token from https://huggingface.co/settings/tokens → Create Read+Write)
huggingface-cli login

# Clone your new empty Space
git clone https://huggingface.co/spaces/YOUR_USERNAME/winlator-frost
# Copy this project into it
Copy-Item -Recurse -Force C:\Users\ilias\Documents\winlator-frost-website\* C:\Users\ilias\Documents\winlator-frost\
Copy-Item C:\Users\ilias\Documents\winlator-frost-website\.env.local C:\Users\ilias\Documents\winlator-frost\  # contains Supabase URL (needed at build)
Set-Location C:\Users\ilias\Documents\winlator-frost
git add .
git commit -m "feat: deploy Winlator Frost to HF Spaces"
git push
```
HF will auto-build Docker (see logs in Space → Logs). In ~4 min, Space is live at `https://YOUR_USERNAME-winlator-frost.hf.space`.

### 3. Add Env Vars (Critical for Supabase News)
Space → Settings → Variables and secrets → Add:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://xcahjcxoacyxouvkcvcq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_...` (from `.env.local:2`)
→ Space auto-rebuilds.

### 4. Test on Mobile (as you did with trycloudflare)
Open `https://YOUR_USERNAME-winlator-frost.hf.space` on mobile data (incognito) → Homepage, News (Supabase), Downloads → Upload 239 MB APK via Admin → should show `Self-hosted (5 GB)` progress bar → Download via `206 Partial Content` Range (resumable, pause/resume).

### 5. Optional: Get `winlator-frost.pages.dev` Free Too
If you still want `winlator-frost.pages.dev` free (Cloudflare Pages, unlimited bandwidth, no card):
```powershell
npm run build
npx wrangler login
npx wrangler pages project create winlator-frost
npx wrangler pages deploy .next --project-name=winlator-frost
# → https://winlator-frost.pages.dev free
# But Pages has no persistent disk — keep releases on HF Space. Make pages.dev redirect to HF Space or use R2 (see below) if you want pure Pages.
```
Simpler: In Cloudflare Dashboard → DNS → Add `CNAME winlator-frost.pages.dev → YOUR_USERNAME-winlator-frost.hf.space` is not allowed (pages.dev owned by Cloudflare). Use HF URL as primary free domain; later you can add custom `winlator-frost.co.th` via Cloudflare → Custom hostname → CNAME to HF Space (free SSL).

### 6. Keep Uploads Persistent
HF Docker Spaces persist at `/data` — our `app/api/admin/releases/upload/route.ts:18` now detects `SPACE_ID` or `/data` exists and writes to `/data/uploads/releases/{version}/`. `app/api/downloads/[version]/route.ts:22` reads from `/data/uploads` first, then `process.cwd()/uploads`. Your 247 MB file survives Space restarts (unlike local PC `uploads/` which needed backup).

### Troubleshooting

- **Build fails:** Check Space logs → Ensure `NEXT_PUBLIC_*` set before build (HF rebuilds after adding vars).
- **413 still?** Not on HF — HF has no 50 MB Supabase limit for local host. If you still use Supabase storage, run `supabase-bucket-5gb.sql` in Dashboard SQL Editor, but local host bypasses it.
- **Upload fails on HF:** Ensure Space hardware is `CPU basic` (not `CPU upgrade` which needs card). Free has 16 GB RAM enough for 5 GB streaming via `busboy`.

### Cost

| Item | Cost |
|------|------|
| HF Spaces CPU basic | 0 THB, no card, 50 GB persistent |
| Cloudflare Tunnel / Pages `pages.dev` | 0 THB |
| Supabase news | 0 THB free tier |
| Domain `hf.space` | 0 THB auto |
| `winlator-frost.co.th` later | ~1,190 THB/yr (optional) |

Your PC can now be off — HF serves 24/7 free.

Want me to generate the exact `git push` commands with your HF username, or run `huggingface-cli` here to create the Space for you?
