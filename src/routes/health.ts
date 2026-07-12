import { Router, Request, Response } from "express";
import { isModelLoaded, getModelName } from "../services/embedding.js";
import {
  isImageModelLoaded,
  getImageModelName,
} from "../services/image-embedding.js";
import { config } from "../config.js";

const router = Router();
const startTime = Date.now();

router.get("/health", (_req: Request, res: Response) => {
  const models = [];
  if (isModelLoaded()) models.push(getModelName());
  if (isImageModelLoaded()) models.push(getImageModelName());

  res.json({
    status: "ok",
    service: "yishe-models",
    models,
    modelLoaded: isModelLoaded(),
    imageModelLoaded: isImageModelLoaded(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    env: config.nodeEnv,
  });
});

export default router;
