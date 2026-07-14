import fs from "fs";
import path from "path";
import https from "https";
import { URL } from "url";

const CACHE_DIR = "./models_new/Xenova/clip-vit-base-patch32/onnx";
const FILES = [
  {
    name: "model.onnx",
    url: "https://hf-mirror.com/Xenova/clip-vit-base-patch32/resolve/main/onnx/model.onnx"
  },
  {
    name: "vision_model.onnx",
    url: "https://hf-mirror.com/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model.onnx"
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(targetUrl, targetPath, isRedirect = false) {
  return new Promise((resolve, reject) => {
    // 替换域名以走国内 hf-mirror 代理
    let reqUrl = targetUrl;
    if (!isRedirect && reqUrl.includes("huggingface.co")) {
      reqUrl = reqUrl.replace("cdn-lfs.huggingface.co", "cdn-lfs.hf-mirror.com");
      reqUrl = reqUrl.replace("huggingface.co", "hf-mirror.com");
    }

    console.log(`[download] Requesting: ${reqUrl}`);
    const parsedUrl = new URL(reqUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
      }
    };

    const req = https.get(options, (res) => {
      // 处理 301, 302, 307, 308 重定向
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          reject(new Error(`Redirect status ${res.statusCode} received but no location header found`));
          return;
        }
        console.log(`[download] Redirected to: ${redirectUrl}`);
        // 递归请求重定向地址
        downloadFile(redirectUrl, targetPath, true).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download, status code: ${res.statusCode}`));
        return;
      }

      const totalSize = parseInt(res.headers["content-length"] || "0", 10);
      console.log(`[download] Status: 200 OK. Content-Length: ${totalSize} bytes`);

      const fileStream = fs.createWriteStream(targetPath);
      let downloadedSize = 0;
      let lastPercent = 0;

      res.on("data", (chunk) => {
        downloadedSize += chunk.length;
        fileStream.write(chunk);
        
        if (totalSize > 0) {
          const percent = Math.floor((downloadedSize / totalSize) * 100);
          if (percent - lastPercent >= 5 || percent === 100) {
            process.stdout.write(`\r[download] Progress: ${percent}% (${(downloadedSize / (1024 * 1024)).toFixed(1)}MB / ${(totalSize / (1024 * 1024)).toFixed(1)}MB)`);
            lastPercent = percent;
          }
        }
      });

      res.on("end", () => {
        fileStream.end();
        console.log(`\n[download] Finished saving: ${path.basename(targetPath)}`);
        resolve();
      });

      res.on("error", (err) => {
        fileStream.end();
        reject(err);
      });
    });

    req.on("error", reject);
  });
}

async function main() {
  console.log("=== Hf-Mirror LFS Downloader (No Redirect to HF) ===");
  ensureDir(CACHE_DIR);

  for (const file of FILES) {
    const targetPath = path.join(CACHE_DIR, file.name);
    console.log(`\n[file] Starting download for: ${file.name}`);
    
    // 如果已经存在，我们先清理掉
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
      } catch (e) {
        console.log(`[warning] Failed to remove existing file: ${e.message}`);
      }
    }

    let success = false;
    let retries = 3;
    while (!success && retries > 0) {
      try {
        await downloadFile(file.url, targetPath);
        success = true;
      } catch (err) {
        retries--;
        console.error(`\n[error] Download failed for ${file.name}: ${err.message}. Retries left: ${retries}`);
        if (retries === 0) {
          console.error(`[error] ❌ Failed to download ${file.name} after multiple attempts.`);
          process.exit(1);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.log("\n[download] 🎉 All model files downloaded successfully!");
}

main().catch(console.error);
