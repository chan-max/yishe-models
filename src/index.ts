import express from "express";
import { config } from "./config.js";
import healthRouter from "./routes/health.js";
import embeddingsRouter from "./routes/embeddings.js";
import imageEmbeddingsRouter from "./routes/image-embeddings.js";
import modelsRouter from "./routes/models.js";
import { preloadModel } from "./services/embedding.js";

const app = express();

// Middleware
app.use(express.json({ limit: "25mb" }));

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Routes
app.use(healthRouter);
app.use(embeddingsRouter);
app.use(imageEmbeddingsRouter);
app.use(modelsRouter);

// 404
app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { message: "Not Found", type: "invalid_request_error" } });
});

// Start server
async function main() {
  console.log("=".repeat(50));
  console.log("  Yishe Models - Local AI Inference Server");
  console.log("=".repeat(50));

  // Preload model in background
  console.log("[server] Preloading embedding model...");
  preloadModel().catch((err) => {
    console.error("[server] Model preload failed:", err?.message || err);
  });

  app.listen(config.port, config.host, () => {
    console.log(`[server] Listening on http://${config.host}:${config.port}`);
    console.log(`[server] Health: http://${config.host}:${config.port}/health`);
    console.log(
      `[server] Embeddings: POST http://${config.host}:${config.port}/v1/embeddings`,
    );
    console.log(
      `[server] Image embeddings: POST http://${config.host}:${config.port}/v1/image-embeddings`,
    );
    console.log(
      `[server] Models: GET http://${config.host}:${config.port}/v1/models`,
    );
    console.log("=".repeat(50));
  });
}

main().catch((err) => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
