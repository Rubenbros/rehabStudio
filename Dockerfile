# syntax=docker/dockerfile:1

# Imagen para Google Cloud Run (europe-west1). Construir SIEMPRE para linux/amd64:
#   docker build --platform=linux/amd64 \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://therehabstudio.es \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#     -t rehab-studio .
# Cloud Build / GitHub Actions (ubuntu) ya construyen en amd64 por defecto.

############################
# Stage 1: deps (npm ci)
############################
FROM node:22-slim AS deps
WORKDIR /app

# ca-certificates/openssl: TLS hacia Supabase, Twilio, Google APIs y DeepSeek.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

############################
# Stage 2: build
############################
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- NEXT_PUBLIC_* se INLINEAN en build time: deben existir como ENV antes de `next build` ---
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# `next build` con output: "standalone" (next.config.ts)
RUN npm run build

############################
# Stage 3: runner
############################
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# TLS hacia servicios externos en runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# Usuario no-root
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Salida standalone: server.js + node_modules trazados.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# static y public NO van dentro de standalone: hay que copiarlos aparte.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

# Cloud Run inyecta PORT (8080); el server standalone lo respeta.
CMD ["node", "server.js"]
