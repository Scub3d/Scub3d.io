"""
Local dev server for testing views/www/*.html.

Serves from the project root on http://localhost:8766/, mapping `/` and
`/<page>.html` to the corresponding file under views/www/ so the nav's
relative hrefs (experience.html, hackathons.html, ...) resolve without
needing the production subdomain.

Rewrites //static.scub3d.io/www/ and https://static.scub3d.io/www/
references to local /static/www/ paths in HTML and in JS/JSON under
/static/www/, so edits to local assets are actually exercised instead
of the production CDN.

Also rewrites cross-subdomain links like //minesweeper.scub3d.io/ to
local /minesweeper/ paths, and serves views/minesweeper/*.html at
/minesweeper/ so those links work end-to-end locally.

Usage:
    python tooling/serve_www_test.py
Then open:
    http://localhost:8766/
"""
from __future__ import annotations

import http.server
import mimetypes
import re
import socketserver
import sys
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8766
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
WWW_DIR = PROJECT_ROOT / "views" / "www"
VIEWS_DIR = PROJECT_ROOT / "views"

# Subdomains that have their own views/<sub>/ tree. Links like
# //<sub>.scub3d.io/ in www HTML get rewritten to /<sub>/ and routed there.
CROSS_SUBDOMAINS = ("minesweeper", "ar")

REWRITE = re.compile(rb"(?:https?:)?//static\.scub3d\.io/")
REWRITE_FUNCTIONS = re.compile(rb"https://us-central1-scub3d\.cloudfunctions\.net/")
FUNCTIONS_LOCAL_BASE = b"http://localhost:2053/scub3d/us-central1/"
REWRITE_SUBDOMAINS = [
    (re.compile(rb"(?:https?:)?//" + sub.encode() + rb"\.scub3d\.io/"), b"/" + sub.encode() + b"/")
    for sub in CROSS_SUBDOMAINS
]

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")


def rewrite(data: bytes) -> bytes:
    data = REWRITE.sub(b"/static/", data)
    data = REWRITE_FUNCTIONS.sub(FUNCTIONS_LOCAL_BASE, data)
    for pattern, replacement in REWRITE_SUBDOMAINS:
        data = pattern.sub(replacement, data)
    return data


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        # Root → views/www/index.html
        if self.path in ("/", ""):
            self._serve_rewritten(WWW_DIR / "index.html", "text/html; charset=utf-8")
            return
        # Top-level /<page>.html → views/www/<page>.html (so nav hrefs resolve)
        if re.fullmatch(r"/[\w-]+\.html", self.path):
            candidate = WWW_DIR / self.path.lstrip("/")
            if candidate.exists():
                self._serve_rewritten(candidate, "text/html; charset=utf-8")
                return
        # Cross-subdomain routing: /<sub>/ → views/<sub>/index.html,
        # /<sub>/<page>.html → views/<sub>/<page>.html
        sub_match = re.fullmatch(r"/(" + "|".join(CROSS_SUBDOMAINS) + r")/([\w-]+\.html)?", self.path)
        if sub_match:
            sub, page = sub_match.group(1), sub_match.group(2) or "index.html"
            candidate = VIEWS_DIR / sub / page
            if candidate.exists():
                self._serve_rewritten(candidate, "text/html; charset=utf-8")
                return
        # Rewrite JS/JSON under /static/ so references inside data files
        # also point at the local server. Rewrites are idempotent no-ops when
        # the file contains no external scub3d URLs.
        if self.path.startswith("/static/") and (self.path.endswith(".js") or self.path.endswith(".json")):
            file_path = PROJECT_ROOT.joinpath(*self.path.lstrip("/").split("/"))
            if file_path.exists():
                content_type = "application/javascript" if self.path.endswith(".js") else "application/json"
                self._serve_rewritten(file_path, content_type)
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
            print(f"Serving www test at http://{HOST}:{PORT}/", flush=True)
            print("Pages: / (index), /experience.html, /hackathons.html, /projects.html, /hikes.html", flush=True)
            print("Ctrl+C to stop.", flush=True)
            httpd.serve_forever()
    except OSError as err:
        print(f"Failed to bind {HOST}:{PORT} - {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
