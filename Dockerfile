# SYLHN POS — Dockerfile (multi-stage production build)
# Builds a minimal standalone Next.js image with Bun runtime.

# ===== Stage 1: Install deps =====
FROM oven/bun:1 AS deps
WORKDIR /app

# Copy lockfile + package.json first (better layer caching)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ===== Stage 2: Build =====
FROM oven/bun:1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needs schema.prisma)
RUN bun run db:generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ===== Stage 3: Production runner =====
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Install sqlite3 for backup/restore operations + curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r sylhn && useradd -r -g sylhn -d /app -s /bin/bash sylhn

# Copy standalone build + public assets + prisma
COPY --from=builder --chown=sylhn:sylhn /app/.next/standalone ./
COPY --from=builder --chown=sylhn:sylhn /app/.next/static ./.next/static
COPY --from=builder --chown=sylhn:sylhn /app/public ./public
COPY --from=builder --chown=sylhn:sylhn /app/prisma ./prisma
COPY --from=builder --chown=sylhn:sylhn /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=sylhn:sylhn /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=sylhn:sylhn /app/package.json ./package.json

# Create data directories
RUN mkdir -p /app/db /app/backups && chown -R sylhn:sylhn /app/db /app/backups

# Switch to non-root user
USER sylhn

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/db/custom.db

# Health check (every 30s, fail after 3 retries = 90s)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the app
CMD ["bun", "server.js"]
