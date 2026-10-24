import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
} from "@huggingface/transformers";
import sharp from "sharp";
import { config } from "../config.js";

/** 单张图片下载超时，避免慢速/挂起的外链拖死整批 */
const DOWNLOAD_TIMEOUT_MS = 20_000;
/** 单张图片最大下载字节数，超大原图（如 700MB 星空图）直接判失败 */
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
/** 解码像素上限，防止超大图解码时内存暴涨/卡死 */
const MAX_INPUT_PIXELS = 40_000_000;
/** 统一缩放到模型输入尺寸附近，解码小图更快 */
const TARGET_SIZE = 448;

let imageModel: any = null;
let imageProcessor: any = null;
let loadingPromise: Promise<{ processor: any; model: any }> | null = null;

/**
 * MobileCLIP2-S2 说明：vision_model.onnx 输入 [batch,3,256,256] float32，
 * 输出 image_embeds [batch,512]（未归一化，共享图文空间）。相比 SigLIP-base
 * 权重 136MB（原 177MB fp16），算力约 1/8，单张耗时从 1.5s 降到 0.25s 量级。
 */
async function getModelAndProcessor() {
  if (imageModel && imageProcessor) return { processor: imageProcessor, model: imageModel };
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log(`[image-embedding] Loading model: ${config.defaultImageModel}`);
    console.log(`[image-embedding] Model dir: ${config.modelsDir}`);
    const start = Date.now();

    const loadedModel = await CLIPVisionModelWithProjection.from_pretrained(
      config.defaultImageModel,
      { model_file_name: "vision_model", dtype: "fp32" },
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

/** 统一解码为缩略图 RawImage：限制像素上限，避免超大图卡死 */
async function decodeImageBuffer(buffer: Buffer): Promise<RawImage> {
  const resized = await sharp(buffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
    animated: false,
    failOn: "none",
  })
    .rotate()
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const blob = new Blob([new Uint8Array(resized)], { type: "image/png" });
  return RawImage.fromBlob(blob);
}

/** 下载远程图片（带超时 + 体积上限），再交给 sharp 缩放解码 */
async function fetchRemoteImage(url: string): Promise<RawImage> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`download failed: HTTP ${res.status}`);
  }
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download too large: ${declared} bytes`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new Error(`download too large: ${buffer.length} bytes`);
  }
  return decodeImageBuffer(buffer);
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
    return fetchRemoteImage(trimmed);
  }

  return decodeImageBuffer(buffer);
}

/** 从 image_embeds 张量切出每条向量并 L2 归一化 */
function normalizeEmbeds(embeds: any, expectedCount: number): number[][] {
  const dims = embeds?.dims || [];
  const values = Array.from(embeds?.data || []) as number[];

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
    `unexpected image_embeds tensor shape: dims=${JSON.stringify(dims)}, expected=${expectedCount}`,
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
      const vectors = normalizeEmbeds((output as any).image_embeds, 1);
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
