#!/usr/bin/env python3
import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

REGISTRY = {
    "models": [
        {
            "id": "qwen2.5-7b-instruct",
            "name": "Qwen 2.5 7B Instruct",
            "family": "Qwen",
            "provider": "Local GPU Worker",
            "runtime": "python",
            "endpoint": "/api/llm/chat",
            "status": "running",
            "mode": "chat",
            "updatedAt": "2026-03-12 15:10",
            "tags": ["quantized", "local", "chat"],
        },
        {
            "id": "bge-m3",
            "name": "BGE M3",
            "family": "BGE",
            "provider": "Embedding Worker",
            "runtime": "python",
            "endpoint": "/api/llm/embedding",
            "status": "running",
            "mode": "embedding",
            "updatedAt": "2026-03-12 14:30",
            "tags": ["embedding", "rerank"],
        },
        {
            "id": "cosyvoice-clone",
            "name": "CosyVoice Clone",
            "family": "CosyVoice",
            "provider": "Voice Worker",
            "runtime": "python",
            "endpoint": "/api/llm/voice/clone",
            "status": "degraded",
            "mode": "tts",
            "updatedAt": "2026-03-12 13:57",
            "tags": ["voice-clone", "audio"],
        },
    ]
}


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(200, {"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send(200, {"service": "python-runtime", "status": "ok", "models": len(REGISTRY["models"])})
            return
        if parsed.path == "/models":
            self._send(200, {"models": REGISTRY["models"]})
            return
        self._send(404, {"message": "Not Found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/models/") and parsed.path.endswith("/start"):
            model_id = parsed.path.split("/")[2]
            self._set_status(model_id, "running")
            self._send(200, {"success": True, "message": f"Model {model_id} started."})
            return
        if parsed.path.startswith("/models/") and parsed.path.endswith("/stop"):
            model_id = parsed.path.split("/")[2]
            self._set_status(model_id, "stopped")
            self._send(200, {"success": True, "message": f"Model {model_id} stopped."})
            return
        if parsed.path == "/invoke/chat":
            self._send(
                200,
                {
                    "id": "demo-chat-response",
                    "model": "qwen2.5-7b-instruct",
                    "output": "This is a placeholder chat response from the local python runtime.",
                },
            )
            return
        self._send(404, {"message": "Not Found"})

    def log_message(self, format, *args):
        return

    def _set_status(self, model_id: str, status: str) -> None:
        for model in REGISTRY["models"]:
            if model["id"] == model_id:
                model["status"] = status
                model["updatedAt"] = now_text()
                break


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"yishe python runtime listening on http://127.0.0.1:{port}")
    server.serve_forever()
