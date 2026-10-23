import { env } from "@huggingface/transformers";

process.env.HF_ENDPOINT = "https://hf-mirror.com";
process.env.HF_REMOTE_HOST = "https://hf-mirror.com";

export const config = {
  port: parseInt(process.env.PORT || "8900", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  modelsDir: process.env.MODELS_DIR || "./models",
  defaultModel:
    process.env.DEFAULT_MODEL || "onnx-community/bge-small-zh-v1.5-ONNX",
  defaultImageModel:
    process.env.DEFAULT_IMAGE_MODEL || "mobileclip2-s2",
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "128", 10),
  maxImageBatchSize: parseInt(process.env.MAX_IMAGE_BATCH_SIZE || "4", 10),
};

// 所有模型已随镜像打包在 models/，禁止运行时联网拉取，避免线上下载与版本漂移
env.localModelPath = config.modelsDir;
env.cacheDir = config.modelsDir;
env.allowRemoteModels = false;
env.allowLocalModels = true;
