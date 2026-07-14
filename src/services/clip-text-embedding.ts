import { AutoModel, AutoTokenizer, env } from "@huggingface/transformers";
import { config } from "../config.js";

env.cacheDir = config.modelsDir;

// Use HF mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || "https://hf-mirror.com";

let clipModel: any = null;
let clipTokenizer: any = null;
let loadingPromise: Promise<{ model: any; tokenizer: any }> | null = null;

async function getModelAndTokenizer() {
  if (clipModel && clipTokenizer) return { model: clipModel, tokenizer: clipTokenizer };
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[clip-text-embedding] Loading model and tokenizer: ${config.defaultImageModel}`);
    console.log(`[clip-text-embedding] Cache dir: ${config.modelsDir}`);
    const start = Date.now();

    const loadedModel = await AutoModel.from_pretrained(
      config.defaultImageModel,
      {
        model_file_name: "text_model",
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

    const loadedTokenizer = await AutoTokenizer.from_pretrained(
      config.defaultImageModel
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[clip-text-embedding] Model and tokenizer loaded in ${elapsed}s`);
    clipModel = loadedModel;
    clipTokenizer = loadedTokenizer;
    return { model: loadedModel, tokenizer: loadedTokenizer };
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
  const { model, tokenizer } = await getModelAndTokenizer();
  const results: number[][] = [];

  for (const text of texts) {
    const inputs = tokenizer([text], { padding: true, truncation: true });
    const output = await model(inputs);

    if (!output.text_embeds) {
      throw new Error("No text_embeds found in model output");
    }

    const rawVector = Array.from(output.text_embeds.data) as number[];
    const l2Norm = Math.sqrt(rawVector.reduce((sum, val) => sum + val * val, 0));
    const normalizedVector = l2Norm > 0 ? rawVector.map((val) => val / l2Norm) : rawVector;

    results.push(normalizedVector);
  }

  return results;
}

export function isClipTextModelLoaded(): boolean {
  return clipModel !== null && clipTokenizer !== null;
}

export function getClipTextModelName(): string {
  return config.defaultImageModel;
}

export async function preloadClipTextModel(): Promise<void> {
  await getModelAndTokenizer();
}
