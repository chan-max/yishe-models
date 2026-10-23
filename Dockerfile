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

# Stage 2: Production
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

# 模型随仓库提供，构建期不再联网下载（无需 HuggingFace 访问）
# 大 ONNX 以 .part-* 分片提交（GitHub 单文件 100MB 限制），此处还原
COPY models ./models

RUN cd /app/models/mobileclip2-s2/onnx && \
    cat vision_model.onnx.part-* > vision_model.onnx && \
    cat text_model_int8.onnx.part-* > text_model_int8.onnx && \
    rm -f ./*.part-*

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
