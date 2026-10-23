import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  Tensor,
} from "@huggingface/transformers";
import { config } from "../config.js";

let clipModel: any = null;
let clipTokenizer: any = null;
let loadingPromise: Promise<{ model: any; tokenizer: any }> | null = null;

async function getModelAndTokenizer() {
  if (clipModel && clipTokenizer) return { model: clipModel, tokenizer: clipTokenizer };
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[clip-text-embedding] Loading model and tokenizer: ${config.defaultImageModel}`);
    console.log(`[clip-text-embedding] Model dir: ${config.modelsDir}`);
    const start = Date.now();

    const loadedModel = await CLIPTextModelWithProjection.from_pretrained(
      config.defaultImageModel,
      { model_file_name: "text_model", dtype: "int8" },
    );

    const loadedTokenizer = await AutoTokenizer.from_pretrained(
      config.defaultImageModel,
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
 * 生成与图像塔共享空间的文本嵌入（MobileCLIP2-S2，512 维）。
 * 注意：文本塔是英文语料训练的，中文 query 效果差；中文语义检索走
 * bge-small-zh（/v1/embeddings），不要用这里。
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { model, tokenizer } = await getModelAndTokenizer();
  const results: number[][] = [];

  for (const text of texts) {
    // MobileCLIP2（OpenCLIP 系）文本塔必须补 0（不是 EOS）到固定 77 token，
    // 否则池化位置落在 padding 上，文本向量会退化成几乎相同的方向。
    const encoded = tokenizer(text, { padding: false, truncation: true });
    const ids = Array.from(encoded.input_ids.data as BigInt64Array)
      .slice(0, 76)
      .map(Number);
    const padded = BigInt64Array.from(
      [...ids, ...new Array(77 - ids.length).fill(0)].map((v) => BigInt(v)),
    );
    const inputIds = new Tensor("int64", padded, [1, 77]);

    const output = await model({ input_ids: inputIds });

    const embeds = (output as any).text_embeds;
    if (!embeds) {
      throw new Error("No text_embeds found in model output");
    }

    const rawVector = Array.from(embeds.data) as number[];
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
