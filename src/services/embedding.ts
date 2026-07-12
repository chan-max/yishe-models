import { pipeline, env } from '@huggingface/transformers';
import { config } from '../config.js';

// Configure where models are cached
env.cacheDir = config.modelsDir;

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

  // Process in batches for efficiency
  const batchSize = config.maxBatchSize;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const outputs = await Promise.all(
      batch.map(async (text) => {
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data) as number[];
      })
    );
    results.push(...outputs);
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
