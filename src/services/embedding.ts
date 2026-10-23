import { pipeline, env } from '@huggingface/transformers';
import { config } from '../config.js';

// Configure where models are cached
env.cacheDir = config.modelsDir;

// Use HF mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || 'https://hf-mirror.com';

// Lazy-loaded pipeline instance
let featureExtractor: any = null;
let loadingPromise: Promise<any> | null = null;

/**
 * Get or initialize the feature extraction pipeline.
 * Downloads the model on first call, then caches in memory.
 */
async function getPipeline() {
  if (featureExtractor) return featureExtractor;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[embedding] Loading model: ${config.defaultModel}`);
    console.log(`[embedding] Cache dir: ${config.modelsDir}`);
    const start = Date.now();

    const pipe = await pipeline('feature-extraction', config.defaultModel, {
      // Prefer local cache, download if missing
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          const pct = progress.progress ?? 0;
          process.stdout.write(`\r[embedding] Downloading: ${pct.toFixed(1)}%`);
        }
        if (progress.status === 'done') {
          console.log(`\n[embedding] Download complete: ${progress.file}`);
        }
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[embedding] Model loaded in ${elapsed}s`);
    featureExtractor = pipe;
    return pipe;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

/**
 * Generate embeddings for one or more texts.
 * Returns array of embedding vectors (each is number[]).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const pipe = await getPipeline();
  const results: number[][] = [];

  // Process in batches for efficiency.
  // @huggingface/transformers pipeline supports array input natively:
  // pipe([text1, text2, ...]) performs batched inference in one pass,
  // which is far faster than calling pipe(text) sequentially in a loop.
  const batchSize = config.maxBatchSize;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    // bge 系列使用 CLS pooling（模型卡片明确要求），mean 会导致语义质量下降
    const output = await pipe(batch, { pooling: 'cls', normalize: true });
    // output: [batch, dim] tensor → tolist() gives number[][]
    const vectors = output.tolist() as number[][];
    results.push(...vectors);
  }

  return results;
}

/**
 * Check if the model is loaded.
 */
export function isModelLoaded(): boolean {
  return featureExtractor !== null;
}

/**
 * Get the model name.
 */
export function getModelName(): string {
  return config.defaultModel;
}

/**
 * Preload the model at startup (optional).
 */
export async function preloadModel(): Promise<void> {
  await getPipeline();
}
