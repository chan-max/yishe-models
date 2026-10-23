# 多阶段构建 - 构建阶段
FROM node:22-slim AS builder

WORKDIR /app

# 先复制依赖清单，利用缓存
COPY package.json package-lock.json* ./

# 安装所有依赖（含 devDependencies 用于构建）
RUN npm install --ignore-scripts

# 复制源码与配置
COPY tsconfig.json ./
COPY src/ ./src/

# 构建 TypeScript
RUN npm run build

# 在 builder 阶段把模型分片合并还原（GitHub 单文件 100MB 限制），
# 最终镜像只带合并后的 ONNX，避免分片与合并文件双份占用
COPY models ./models
RUN cd /app/models/mobileclip2-s2/onnx && \
    cat vision_model.onnx.part-* > vision_model.onnx && \
    cat text_model_int8.onnx.part-* > text_model_int8.onnx && \
    rm -f ./*.part-*

# 生产运行阶段
FROM node:22-slim

# 仅安装运行时系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN groupadd -g 1001 models && \
    useradd -u 1001 -g models -s /bin/false models

WORKDIR /app

# 仅安装生产依赖（不跑脚本，避免 onnxruntime 多余行为）
COPY package.json package-lock.json* ./
RUN npm install --production --ignore-scripts && \
    npm cache clean --force

# 复制构建产物与模型（--chown 直接归属 models 用户，
# 避免 RUN chown -R 因写时复制导致整个 /app 重复占一层）
COPY --chown=models:models --from=builder /app/dist ./dist
COPY --chown=models:models --from=builder /app/models ./models

USER models

EXPOSE 8900

# 健康检查：预热模型需较长时间，start-period 给足
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
  CMD curl -f http://localhost:8900/health || exit 1

CMD ["node", "dist/index.js"]
