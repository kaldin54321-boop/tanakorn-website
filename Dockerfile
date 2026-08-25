# Winlator@Frost - self-hosted file host (releases) + Supabase (news)
# Keeps uploads/ persistent via volume
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js standalone needs env at build time for NEXT_PUBLIC_*
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

# Production image - self-hosted, free, keeps uploads/
# Supports Oracle VPS (3000), HF Spaces (7860), Render (10000 via $PORT) - all via $PORT
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Render injects PORT=10000, HF uses 7860, local uses 3000 - respect env
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create uploads dir for self-hosted APKs (5GB, separate from Supabase)
# HF persistent is /data, Render/local is /app/uploads - support both, Render free is ephemeral (use external_url for 239MB+)
RUN mkdir -p /app/uploads/releases /app/uploads/tmp /data/uploads/releases /data/uploads/tmp && chown -R nextjs:nodejs /app/uploads /data 2>/dev/null || true

USER nextjs
EXPOSE 3000
EXPOSE 7860
EXPOSE 10000
CMD ["node", "server.js"]
