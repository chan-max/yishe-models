# Yishe Models

本地 AI 模型推理服务器，为 design-server 等项目提供 OpenAI 兼容的 embedding 和 LLM 推理能力。

## 特性

- **OpenAI 兼容 API** - 无缝对接现有 OpenAI SDK 代码
- **本地推理** - 零 API 费用，数据不出服务器
- **离线可用** - 无需网络即可运行
- **一键启动** - `npm run dev` 即可运行

## 快速开始

### 开发模式

```bash
npm install
npm run dev
```

服务启动在 `http://localhost:8900`

### API 端点

```bash
# 健康检查
curl http://localhost:8900/health

# 获取模型列表
curl http://localhost:8900/v1/models

# 生成 Embedding（OpenAI 兼容）
curl -X POST http://localhost:8900/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"Xenova/all-MiniLM-L6-v2","input":"hello world"}'
```

### Docker 部署

```bash
docker compose up -d
```

## 项目结构

```
yishe-models/
├── src/
│   ├── index.ts              # Express 入口
│   ├── config.ts             # 环境配置
│   ├── routes/
│   │   ├── health.ts         # GET /health
│   │   ├── embeddings.ts     # POST /v1/embeddings
│   │   └── models.ts         # GET /v1/models
│   ├── services/
│   │   └── embedding.ts      # 模型加载 + 推理
│   └── types/
│       └── embedding.ts      # 类型定义
├── Dockerfile                # 多阶段构建
├── docker-compose.yml        # 本地开发
├── docker-compose.hub.yml    # 生产部署
└── .github/workflows/        # GitHub Actions CI/CD
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8900` | 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `MODELS_DIR` | `./models` | 模型缓存目录 |
| `DEFAULT_MODEL` | `Xenova/all-MiniLM-L6-v2` | 默认 embedding 模型 |

## 与 design-server 集成

### 方式一：通过环境变量配置（推荐）

在 design-server 的 `.env.development` 中配置：

```bash
# 使用本地 yishe-models 服务
MODEL_SERVICE_BASE_URL=http://localhost:8900
MODEL_SERVICE_API_KEY=not-needed
```

在 design-server 的 `.env.production` 中配置：

```bash
# 使用在线 OpenAI 服务
MODEL_SERVICE_BASE_URL=https://api.openai.com/v1
MODEL_SERVICE_API_KEY=sk-your-api-key-here
```

### 方式二：通过 AI API Key 管理

在 yishe-admin → 系统管理 → AI API Key 中配置：

| 字段 | 值 |
|------|-----|
| 名称 | 本地模型服务器 |
| Base URL | `http://yishe-models:8900/v1` |
| API Key | `not-needed` |
| 默认模型 | `Xenova/all-MiniLM-L6-v2` |

## 部署

### GitHub Actions

推送代码到 `main` 分支会自动构建 Docker 镜像并部署。

需要配置以下 GitHub Secrets：
- `DOCKER_USERNAME` - Docker Hub 用户名
- `DOCKER_PASSWORD` - Docker Hub 密码/Token
- `SERVER_HOST` - 服务器地址（不配置则跳过部署）
- `SERVER_USERNAME` - SSH 用户名
- `SERVER_PASSWORD` - SSH 密码

### 手动部署

```bash
# 构建镜像
docker build -t yishe-models .

# 运行
docker run -d -p 8900:8900 -v ./models:/app/models yishe-models
```
