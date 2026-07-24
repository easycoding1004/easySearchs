# Multi-stage build for a persistent-server deployment (VPS/Railway/Render/
# Fly.io — not serverless). See CLAUDE.md "배포" section for the rationale:
# this app relies on a single long-lived Node process for its in-memory
# rate-limit throttle (src/lib/naver/openApiClient.ts) and TTL caches
# (src/lib/utils/ttlCache.ts), which only work correctly with one process.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
