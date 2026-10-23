import { AutoProcessor, AutoModel, RawImage, env } from "@huggingface/transformers";
import { config } from "../config.js";

env.cacheDir = config.modelsDir;

// Use HF mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || "https://hf-mirror.com";

let imageModel: any = null;
let imageProcessor: any = null;
let loadingPromise: Promise<{ processor: any; model: any }> | null = null;

/**
 * SigLIP 说明：vision_model.onnx 输出 last_hidden_state [batch,196,768] 与
 * pooler_output [batch,768]。pooler_output 即共享图文空间的图像嵌入
 * （SigLIP 无独立投影头，与文本塔的 pooler_output 对称）。
 * 不能用 image-feature-extraction pipeline 的默认输出（会返回原始像素值），
 * 必须显式取 pooler_output。
 */
async function getModelAndProcessor() {
  if (imageModel && imageProcessor) return { processor: imageProcessor, model: imageModel };
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[image-embedding] Loading model: ${config.defaultImageModel}`);
    console.log(`[image-embedding] Cache dir: ${config.modelsDir}`);
    const start = Date.now();

    const loadedModel = await AutoModel.from_pretrained(
      config.defaultImageModel,
      {
        model_file_name: "vision_model",
        // 服务器内存有限（可用 <1G），fp16 将内存占用减半，检索质量损失可忽略
        dtype: "fp16",
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

    const loadedProcessor = await AutoProcessor.from_pretrained(
      config.defaultImageModel,
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[image-embedding] Model loaded in ${elapsed}s`);
    imageModel = loadedModel;
    imageProcessor = loadedProcessor;
    return { processor: loadedProcessor, model: loadedModel };
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    throw err;
  }
}

function looksLikeBase64Image(input: string): boolean {
  const normalized = input.replace(/\s/g, "");
  return normalized.length > 128 && /^[A-Za-z0-9+/]+={0,2}$/.test(normalized);
}

/** 把远程 URL / data URL / 裸 base64 统一转成 RawImage */
async function toRawImage(input: string): Promise<RawImage> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("image input must not be empty");
  }

  const dataUrlMatch = trimmed.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  let buffer: Buffer | null = null;
  let mime = "image/png";

  if (dataUrlMatch) {
    mime = dataUrlMatch[1] || mime;
    buffer = dataUrlMatch[2]
      ? Buffer.from(dataUrlMatch[3], "base64")
      : Buffer.from(decodeURIComponent(dataUrlMatch[3]), "utf8");
  } else if (looksLikeBase64Image(trimmed)) {
    buffer = Buffer.from(trimmed.replace(/\s/g, ""), "base64");
  } else {
    // 远程 URL（http/https/file）
    return RawImage.fromURL(trimmed);
  }

  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  return RawImage.fromBlob(blob);
}

/** 从 pooler_output 张量切出每条向量并 L2 归一化 */
function normalizePooler(pooled: any, expectedCount: number): number[][] {
  const dims = pooled?.dims || [];
  const values = Array.from(pooled?.data || []) as number[];

  if (!values.length) return [];

  if (dims.length === 2 && dims[0] === expectedCount) {
    const dim = dims[1];
    const vectors: number[][] = [];
    for (let b = 0; b < expectedCount; b++) {
      const raw = values.slice(b * dim, (b + 1) * dim);
      const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
      vectors.push(norm > 0 ? raw.map((v) => v / norm) : raw);
    }
    return vectors;
  }

  if (expectedCount === 1) {
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0));
    return [norm > 0 ? values.map((v) => v / norm) : values];
  }

  throw new Error(
    `unexpected pooler_output tensor shape: dims=${JSON.stringify(dims)}, expected=${expectedCount}`,
  );
}

/**
 * 逐张生成图像嵌入，对单张失败（404 死链、损坏图、格式不支持）容错：
 * 失败的项返回 null，不抛出，保证整批其余图正常完成。
 * 调用方据此把 null 项标记为死链（failed_permanent），不再重试。
 */
export async function embedImages(
  inputs: string[],
): Promise<(number[] | null)[]> {
  const { processor, model } = await getModelAndProcessor();
  const results: (number[] | null)[] = new Array(inputs.length).fill(null);

  for (let i = 0; i < inputs.length; i++) {
    try {
      const image = await toRawImage(inputs[i]);
      const modelInputs = await processor(image);
      const output = await model(modelInputs);
      const vectors = normalizePooler((output as any).pooler_output, 1);
      results[i] = vectors[0] || null;
    } catch (err: any) {
      // 单张失败不阻塞整批；记录原因供上层判死链
      console.warn(
        `[image-embedding] skip image #${i}: ${err?.message || err}`,
      );
      results[i] = null;
    }
  }

  return results;
}

export function isImageModelLoaded(): boolean {
  return imageModel !== null && imageProcessor !== null;
}

export function getImageModelName(): string {
  return config.defaultImageModel;
}

export async function preloadImageModel(): Promise<void> {
  await getModelAndProcessor();
}
