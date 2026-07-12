# Stage 1: Builder
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build)
RUN npm install --ignore-scripts

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Download models from hf-mirror.com (China-accessible)
FROM node:22-slim AS model-downloader

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

COPY scripts/download-models.js ./scripts/

RUN HF_REMOTE_HOST=https://hf-mirror.com MODELS_DIR=/app/models node scripts/download-models.js

# Stage 3: Production
FROM node:22-slim

# Install ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 models && \
    useradd -u 1001 -g models -s /bin/false models

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --production --ignore-scripts && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy downloaded models
COPY --from=model-downloader /app/models ./models

# Fix ownership
RUN chown -R models:models /app

# Switch to non-root user
USER models

# Expose port
EXPOSE 8900

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8900/health || exit 1

# Start
CMD ["node", "dist/index.js"]
