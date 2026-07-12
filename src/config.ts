export const config = {
  port: parseInt(process.env.PORT || "8900", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  modelsDir: process.env.MODELS_DIR || "./models",
  defaultModel: process.env.DEFAULT_MODEL || "Xenova/all-MiniLM-L6-v2",
  defaultImageModel:
    process.env.DEFAULT_IMAGE_MODEL || "Xenova/clip-vit-base-patch32",
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "128", 10),
  maxImageBatchSize: parseInt(process.env.MAX_IMAGE_BATCH_SIZE || "16", 10),
};
