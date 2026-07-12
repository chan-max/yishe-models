import { pipeline, env } from "@huggingface/transformers";
import { config } from "../config.js";

env.cacheDir = config.modelsDir;

// Use HF mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || "https://hf-mirror.com";

let imageFeatureExtractor: any = null;
let loadingPromise: Promise<any> | null = null;

async function getPipeline() {
  if (imageFeatureExtractor) return imageFeatureExtractor;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[image-embedding] Loading model: ${config.defaultImageModel}`);
    console.log(`[image-embedding] Cache dir: ${config.modelsDir}`);
    const start = Date.now();

    const pipe = await pipeline(
      "image-feature-extraction",
      config.defaultImageModel,
      {
        progress_callback: (progress: any) => {
          if (progress.status === "downloading") {
            const pct = progress.progress ?? 0;
            process.stdout.write(
              `\r[image-embedding] Downloading: ${pct.toFixed(1)}%`,
            );
          }
          if (progress.status === "done") {
            console.log(
              `\n[image-embedding] Download complete: ${progress.file}`,
            );
          }
        },
      },
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[image-embedding] Model loaded in ${elapsed}s`);
    imageFeatureExtractor = pipe;
    return pipe;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

function parseDataUrl(input: string): Blob | null {
  const match = input.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;

  const mimeType = match[1] || "image/png";
  const isBase64 = Boolean(match[2]);
  const rawData = match[3] || "";
  const buffer = isBase64
    ? Buffer.from(rawData, "base64")
    : Buffer.from(decodeURIComponent(rawData), "utf8");

  return new Blob([buffer], { type: mimeType });
}

function parseDataUrlAsObjectUrl(input: string): string | null {
  const blob = parseDataUrl(input);
  return blob ? URL.createObjectURL(blob) : null;
}

function looksLikeBase64Image(input: string): boolean {
  const normalized = input.replace(/\s/g, "");
  return normalized.length > 128 && /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
}

function normalizeImageInput(input: string): string | Blob {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("image input must not be empty");
  }

  const dataObjectUrl = parseDataUrlAsObjectUrl(trimmed);
  if (dataObjectUrl) return dataObjectUrl;

  if (looksLikeBase64Image(trimmed)) {
    const blob = new Blob([Buffer.from(trimmed.replace(/\s/g, ""), "base64")], {
      type: "image/png",
    });
    return URL.createObjectURL(blob);
  }

  return trimmed;
}

function splitTensor(output: any, expectedCount: number): number[][] {
  const dims = output?.dims || [];
  const values = Array.from(output?.data || []) as number[];

  if (!values.length) return [];

  if (dims.length === 2 && dims[0] === expectedCount) {
    const dimensions = dims[1];
    return Array.from({ length: expectedCount }, (_, index) =>
      values.slice(index * dimensions, (index + 1) * dimensions),
    );
  }

  if (expectedCount === 1) {
    return [values];
  }

  throw new Error(
    `unexpected image embedding tensor shape: dims=${JSON.stringify(dims)}, expected=${expectedCount}`,
  );
}

export async function embedImages(inputs: string[]): Promise<number[][]> {
  const pipe = await getPipeline();
  const results: number[][] = [];
  const batchSize = config.maxImageBatchSize;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const rawBatch = inputs.slice(i, i + batchSize);
    const batch = rawBatch.map(normalizeImageInput);
    const output = await pipe(batch.length === 1 ? batch[0] : batch);
    results.push(...splitTensor(output, batch.length));
  }

  return results;
}

export function isImageModelLoaded(): boolean {
  return imageFeatureExtractor !== null;
}

export function getImageModelName(): string {
  return config.defaultImageModel;
}

export async function preloadImageModel(): Promise<void> {
  await getPipeline();
}
