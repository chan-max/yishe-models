import { pipeline, env } from "@huggingface/transformers";
import { config } from "../config.js";

env.cacheDir = config.modelsDir;

// Use HF mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || "https://hf-mirror.com";

let clipTextEncoder: any = null;
let loadingPromise: Promise<any> | null = null;

async function getPipeline() {
  if (clipTextEncoder) return clipTextEncoder;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[clip-text-embedding] Loading model: ${config.defaultImageModel}`);
    console.log(`[clip-text-embedding] Cache dir: ${config.modelsDir}`);
    const start = Date.now();

    const pipe = await pipeline(
      "feature-extraction",
      config.defaultImageModel,
      {
        progress_callback: (progress: any) => {
          if (progress.status === "downloading") {
            const pct = progress.progress ?? 0;
            process.stdout.write(
              `\r[clip-text-embedding] Downloading: ${pct.toFixed(1)}%`,
            );
          }
          if (progress.status === "done") {
            console.log(
              `\n[clip-text-embedding] Download complete: ${progress.file}`,
            );
          }
        },
      },
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[clip-text-embedding] Model loaded in ${elapsed}s`);
    clipTextEncoder = pipe;
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
 * Generate CLIP text embeddings for one or more texts.
 * Returns array of 512-dim vectors in the same space as CLIP image embeddings.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const pipe = await getPipeline();
  const results: number[][] = [];

  for (const text of texts) {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data) as number[]);
  }

  return results;
}

export function isClipTextModelLoaded(): boolean {
  return clipTextEncoder !== null;
}

export function getClipTextModelName(): string {
  return config.defaultImageModel;
}

export async function preloadClipTextModel(): Promise<void> {
  await getPipeline();
}
