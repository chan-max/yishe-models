import { Router, Request, Response } from "express";
import { embedImages, getImageModelName } from "../services/image-embedding.js";
import { inferenceQueue, QueueFullError } from "../services/inference-queue.js";
import type {
  ImageEmbeddingRequest,
  ImageEmbeddingResponse,
} from "../types/image-embedding.js";

const router = Router();

router.post("/v1/image-embeddings", async (req: Request, res: Response) => {
  try {
    const body = req.body as ImageEmbeddingRequest;

    const rawInput = body.input ?? body.imageUrl ?? body.imageUrls;

    if (!rawInput) {
      res.status(400).json({
        error: {
          message: "input, imageUrl or imageUrls is required",
          type: "invalid_request_error",
        },
      });
      return;
    }

    const images = Array.isArray(rawInput) ? rawInput : [rawInput];
    const normalizedImages = images
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    if (normalizedImages.length === 0) {
      res.status(400).json({
        error: {
          message: "input must not be empty",
          type: "invalid_request_error",
        },
      });
      return;
    }

    const model = body.model || getImageModelName();
    const embeddings = await inferenceQueue.run(() => embedImages(normalizedImages));

    // embeddings 与 normalizedImages 等长；单张失败为 null（死链/损坏），
    // 用空向量占位并在 failedIndexes 中标注，供调用方判死链永久隔离。
    const failedIndexes: number[] = [];
    const data = embeddings.map((embedding, index) => {
      if (!embedding || embedding.length === 0) failedIndexes.push(index);
      return {
        object: "embedding" as const,
        index,
        embedding: embedding ?? [],
      };
    });

    const response = {
      object: "list",
      data,
      model,
      failedIndexes,
      usage: {
        image_count: normalizedImages.length - failedIndexes.length,
        total_images: normalizedImages.length,
      },
    };

    res.json(response);
  } catch (error: any) {
    if (error instanceof QueueFullError) {
      res.status(503).json({
        error: { message: error.message, type: "server_overloaded" },
      });
      return;
    }
    console.error("[image-embeddings] Error:", error?.message || error);
    res.status(500).json({
      error: {
        message: error?.message || "Internal server error",
        type: "server_error",
      },
    });
  }
});

export default router;
