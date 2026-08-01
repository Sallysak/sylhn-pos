# SYLHN POS — Dockerfile for Railway (multi-stage production build)
# Uses Node.js 22 (Railway native)

# ===== Stage 1: Install deps =====
FROM node:22-slim AS deps
WORKDIR /app

# Install OpenSSL (Prisma requires it)
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files + prisma schema (needed for prisma generate)
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install deps — use --ignore-scripts to skip postinstall
RUN npm install --legacy-peer-deps --ignore-scripts

# Use the LOCAL prisma binary (not npx which downloads the latest v7)
RUN ./node_modules/.bin/prisma generate

# ===== Stage 2: Build =====
FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client using LOCAL binary
RUN ./node_modules/.bin/prisma generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===== Stage 3: Production runner =====
FROM node:22-slim AS runner
WORKDIR /app

# Install curl for health checks + openssl for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy standalone build + public assets + prisma + ALL node_modules
# (need full node_modules for prisma CLI + @prisma/client at runtime)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create data directories
RUN mkdir -p /app/db /app/backups

# Railway provides $PORT dynamically
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Start the app — push Prisma schema first, then start server
CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js db push --accept-data-loss 2>&1; PORT=${PORT:-3000} node server.js"]
