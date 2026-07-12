import { Router, Request, Response } from "express";
import { getModelName } from "../services/embedding.js";
import { getImageModelName } from "../services/image-embedding.js";
import type { ModelListResponse } from "../types/embedding.js";

const router = Router();

router.get("/v1/models", (_req: Request, res: Response) => {
  const response: ModelListResponse = {
    object: "list",
    data: [
      {
        id: getModelName(),
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "local",
      },
      {
        id: getImageModelName(),
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "local",
      },
    ],
  };
  res.json(response);
});

export default router;
