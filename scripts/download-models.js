/**
 * Download models during Docker build using hf-mirror.com
 * Run: node scripts/download-models.js
 *
 * - onnx-community/bge-small-zh-v1.5-ONNX: 中文文本嵌入（fp32，约 91M）
 * - Xenova/siglip-base-patch16-224: 视觉 + 多模态文本嵌入（fp16 双塔，约 389M）
 *   fp16 是关键：服务器内存 <1G 可用，fp32 会 OOM
 */
import {
  AutoModel,
  AutoTokenizer,
  AutoProcessor,
  env,
} from "@huggingface/transformers";
import { mkdirSync } from "fs";

// Use hf-mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || "https://hf-mirror.com";
env.cacheDir = process.env.MODELS_DIR || "./models";

const TEXT_MODEL = "onnx-community/bge-small-zh-v1.5-ONNX";
const IMAGE_MODEL = "Xenova/siglip-base-patch16-224";

async function main() {
  console.log(`[download] Remote host: ${env.remoteHost}`);
  console.log(`[download] Cache dir: ${env.cacheDir}`);
  mkdirSync(env.cacheDir, { recursive: true });

  // ---- 1. 中文文本嵌入（bge-small-zh-v1.5，仅 fp32，内存友好） ----
  console.log(`\n[download] Text model: ${TEXT_MODEL}`);
  try {
    await Promise.all([
      AutoModel.from_pretrained(TEXT_MODEL),
      AutoTokenizer.from_pretrained(TEXT_MODEL),
    ]);
    console.log("[download] ✅ Text model ready");
  } catch (err) {
    console.error("[download] ❌ Text model failed:", err.message);
    process.exit(1);
  }

  // ---- 2. 多模态：SigLIP 图像塔 fp16 ----
  console.log(`\n[download] SigLIP vision tower (fp16): ${IMAGE_MODEL}`);
  try {
    await AutoModel.from_pretrained(IMAGE_MODEL, {
      model_file_name: "vision_model",
      dtype: "fp16",
    });
    console.log("[download] ✅ SigLIP vision tower ready");
  } catch (err) {
    console.error("[download] ❌ SigLIP vision tower failed:", err.message);
    process.exit(1);
  }

  // ---- 3. 多模态：SigLIP 文本塔 fp16 ----
  console.log(`\n[download] SigLIP text tower (fp16): ${IMAGE_MODEL}`);
  try {
    await Promise.all([
      AutoModel.from_pretrained(IMAGE_MODEL, {
        model_file_name: "text_model",
        dtype: "fp16",
      }),
      AutoTokenizer.from_pretrained(IMAGE_MODEL),
      AutoProcessor.from_pretrained(IMAGE_MODEL),
    ]);
    console.log("[download] ✅ SigLIP text tower + tokenizer + processor ready");
  } catch (err) {
    console.error("[download] ❌ SigLIP text tower failed:", err.message);
    process.exit(1);
  }

  console.log("\n[download] All models downloaded successfully!");
}

main();
