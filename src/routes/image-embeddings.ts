import { Router, Request, Response } from "express";
import { embedImages, getImageModelName } from "../services/image-embedding.js";
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
    const embeddings = await embedImages(normalizedImages);

    const response: ImageEmbeddingResponse = {
      object: "list",
      data: embeddings.map((embedding, index) => ({
        object: "embedding" as const,
        index,
        embedding,
      })),
      model,
      usage: {
        image_count: normalizedImages.length,
        total_images: normalizedImages.length,
      },
    };

    res.json(response);
  } catch (error: any) {
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
