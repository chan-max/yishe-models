/**
 * Download models during Docker build using hf-mirror.com
 * Run: node scripts/download-models.js
 */
import { pipeline, env } from '@huggingface/transformers';
import { mkdirSync } from 'fs';

// Use hf-mirror for China network
env.remoteHost = process.env.HF_REMOTE_HOST || 'https://hf-mirror.com';
env.cacheDir = process.env.MODELS_DIR || './models';

const MODELS = [
  { name: 'Xenova/all-MiniLM-L6-v2', task: 'feature-extraction' },
  { name: 'Xenova/clip-vit-base-patch32', task: 'image-feature-extraction' },
];

async function main() {
  console.log(`[download] Remote host: ${env.remoteHost}`);
  console.log(`[download] Cache dir: ${env.cacheDir}`);

  // Ensure cache dir exists
  mkdirSync(env.cacheDir, { recursive: true });

  for (const { name, task } of MODELS) {
    console.log(`\n[download] Downloading ${name} (${task})...`);
    try {
      const pipe = await pipeline(task, name);
      console.log(`[download] ✅ ${name} ready`);
    } catch (err) {
      console.error(`[download] ❌ Failed to download ${name}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n[download] All models downloaded successfully!');
}

main();
