"""
Local dev server for testing views/ar/card.html.

Serves from the project root on http://localhost:8765/, and rewrites
all //static.scub3d.io/ar/ and https://static.scub3d.io/ar/ references
in card.html and common.js to local /static/ar/ paths so our edits
are actually exercised instead of the production CDN.

Usage:
    python tooling/serve_ar_test.py
Then open:
    http://localhost:8765/
"""
from __future__ import annotations

import http.server
import mimetypes
import re
import socketserver
import sys
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

REWRITE = re.compile(rb"(?:https?:)?//static\.scub3d\.io/ar/")
REWRITE_FUNCTIONS = re.compile(rb"https://us-central1-scub3d\.cloudfunctions\.net/")
# Emulator exposes functions at http://HOST:PORT/PROJECT/REGION/NAME
FUNCTIONS_LOCAL_BASE = b"http://localhost:2053/scub3d/us-central1/"

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("text/plain", ".patt")


def rewrite(data: bytes) -> bytes:
    data = REWRITE.sub(b"/static/ar/", data)
    data = REWRITE_FUNCTIONS.sub(FUNCTIONS_LOCAL_BASE, data)
    return data


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        if self.path in ("/", "/card.html"):
            self._serve_rewritten(PROJECT_ROOT / "views" / "ar" / "card.html", "text/html; charset=utf-8")
            return
        # Rewrite any JS file in the ar/ tree — rewrites are idempotent no-ops
        # when the file contains no external scub3d URLs.
        if self.path.startswith("/static/ar/js/") and self.path.endswith(".js"):
            file_path = PROJECT_ROOT.joinpath(*self.path.lstrip("/").split("/"))
            if file_path.exists():
                self._serve_rewritten(file_path, "application/javascript")
                return
        super().do_GET()

    def _serve_rewritten(self, file_path: Path, content_type: str):
        if not file_path.exists():
            self.send_error(404, f"Not found: {file_path}")
            return
        data = rewrite(file_path.read_bytes())
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main():
    try:
        with socketserver.ThreadingTCPServer((HOST, PORT), Handler) as httpd:
            print(f"Serving AR test at http://{HOST}:{PORT}/", flush=True)
            print("Open the URL above in Chrome. Camera prompts will use localhost (treated as secure).", flush=True)
            print("Ctrl+C to stop.", flush=True)
            httpd.serve_forever()
    except OSError as err:
        print(f"Failed to bind {HOST}:{PORT} - {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
