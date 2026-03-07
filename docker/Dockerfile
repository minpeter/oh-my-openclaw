# ── Stage 1: Build oh-my-openclaw from source ──
FROM oven/bun:1-slim AS builder

WORKDIR /build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src/ src/
COPY tsconfig.json ./
RUN bun run build:compile

# ── Stage 2: Runtime ──
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip jq git ca-certificates lsof openssl \
    && rm -rf /var/lib/apt/lists/*

# Install bun (needed by openclaw runtime)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install openclaw CLI globally
RUN npm install -g openclaw

# Install agent-browser + Playwright Chromium with system deps
RUN npm install -g agent-browser \
    && npx playwright install --with-deps chromium

# Copy compiled oh-my-openclaw binary + preset data from builder
COPY --from=builder /build/dist/apex /usr/local/bin/oh-my-openclaw
COPY --from=builder /build/src/presets/ /build/src/presets/

# Container performance optimizations (recommended by openclaw doctor)
ENV NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache
ENV OPENCLAW_NO_RESPAWN=1
RUN mkdir -p /var/tmp/openclaw-compile-cache

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME /root/.openclaw
EXPOSE 18789

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD sh -c 'curl -sf "http://localhost:${OPENCLAW_GATEWAY_PORT:-18789}/health" || exit 1'

ENTRYPOINT ["/entrypoint.sh"]
