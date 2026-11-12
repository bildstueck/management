# syntax=docker/dockerfile:1

# Multi-stage build producing two images from one `docker build`:
#   --target web    the Next.js server (small, standalone output)
#   --target worker full node_modules + source, for the background workers
#                    and one-off `prisma migrate deploy` / seed runs
#
# Prisma 7 with the @prisma/adapter-pg driver adapter does its own query
# building in JS and talks to Postgres through the `pg` driver — there is no
# native query-engine binary to fetch, so plain Alpine (musl) works fine;
# no OpenSSL/glibc workarounds needed.

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- web: Next.js server ----------
FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

# ---------- worker: token-refresh / publish workers, migrations, seed ----------
FROM base AS worker
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Overridden by docker-compose.prod.yml per service (publish worker, token
# worker, migrate/seed one-off jobs) — this is just a sane default.
CMD ["npx", "tsx", "src/workers/publish.ts"]
