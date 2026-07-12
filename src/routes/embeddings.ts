import { Router, Request, Response } from 'express';
import { embed, isModelLoaded, getModelName } from '../services/embedding.js';
import type { EmbeddingRequest, EmbeddingResponse } from '../types/embedding.js';

const router = Router();

router.post('/v1/embeddings', async (req: Request, res: Response) => {
  try {
    const body = req.body as EmbeddingRequest;

    if (!body.input) {
      res.status(400).json({ error: { message: 'input is required', type: 'invalid_request_error' } });
      return;
    }

    // Normalize input to array
    const texts = Array.isArray(body.input) ? body.input : [body.input];

    if (texts.length === 0) {
      res.status(400).json({ error: { message: 'input must not be empty', type: 'invalid_request_error' } });
      return;
    }

    const model = body.model || getModelName();
    const embeddings = await embed(texts);

    const response: EmbeddingResponse = {
      object: 'list',
      data: embeddings.map((embedding, index) => ({
        object: 'embedding' as const,
        index,
        embedding,
      })),
      model,
      usage: {
        prompt_tokens: texts.reduce((sum, t) => sum + t.split(/\s+/).length, 0),
        total_tokens: texts.reduce((sum, t) => sum + t.split(/\s+/).length, 0),
      },
    };

    res.json(response);
  } catch (error: any) {
    console.error('[embeddings] Error:', error?.message || error);
    res.status(500).json({
      error: {
        message: error?.message || 'Internal server error',
        type: 'server_error',
      },
    });
  }
});

export default router;
