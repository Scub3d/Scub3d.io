# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website (scub3d.io) hosted on Google Cloud Storage with Firebase Cloud Functions as the backend. Static HTML is deployed via GCP Cloud Build on push to master, served through Cloudflare CDN. Costs ~$0.02/month.

## Build & Deploy Commands

**Cloud Functions (run from `functions/` directory):**
```bash
cd functions && npm run lint       # ESLint (also runs as pre-deploy hook)
cd functions && npm run serve      # Firebase emulator (functions on port 2053, storage on 9199)
cd functions && npm run deploy     # Deploy functions to Firebase
cd functions && npm run logs       # View function logs
```

**Local static-site test servers (run from project root):**
```bash
python tooling/serve_www_test.py   # http://localhost:8766/ — www pages
python tooling/serve_ar_test.py    # http://localhost:8765/ — views/ar/card.html
```
Both rewrite `//static.scub3d.io/<sub>/` refs to local `/static/<sub>/` paths so your edits are exercised instead of the production CDN. `serve_www_test.py` additionally routes `/minesweeper/` and `/ar/` to their `views/<sub>/` trees and rewrites cross-subdomain `//minesweeper.scub3d.io/` links so local hero CTAs work end-to-end.

**Deployment** happens automatically via Cloud Build when commits are pushed to master. The pipeline (`cloudbuild.yaml`) rsyncs `./static` to `gs://static.scub3d.io`, then rsyncs each `views/<subdomain>/` to its matching bucket (`gs://scub3d.io`, `gs://minesweeper.scub3d.io`, `gs://ar.scub3d.io`). For each page that should be served at an extensionless URL (e.g. `/experience`), the pipeline copies the `.html` file with `Content-Type: text/html` and removes the original — there is no templating step.

## Architecture

### Multi-Subdomain Static Site
- **scub3d.io** (`views/www/`) — portfolio: `index`, `experience`, `hackathons`, `projects`, `hikes`. Vanilla JS.
- **minesweeper.scub3d.io** (`views/minesweeper/`) — 3D Minesweeper game landing pages: `index`, `presskit`, `privacy-policy`. Vanilla JS + Three.js (shared from `static/ar/js/three/`).
- **ar.scub3d.io** (`views/ar/`) — AR business card (`card.html`). Uses A-Frame + jQuery + custom shaders + Firebase client SDK for live widget data.
- **static.scub3d.io** (`static/`) — shared static assets (CSS, JS, fonts, images, videos).

### Directory Layout
- `views/<subdomain>/` — HTML pages per subdomain (plain HTML — no templating).
- `static/<subdomain>/` — CSS, JS, fonts, images, videos per subdomain.
- `functions/` — Firebase Cloud Functions, one directory per service integration.
- `functions/misc/common.js` — shared utilities (API calls, image processing, file ops, Firestore helpers).
- `tooling/` — local dev scripts: test servers (`serve_ar_test.py`, `serve_www_test.py`), globe/trail data generators, scrapers, image optimizers. Not deployed.

### Cloud Functions (Backend)
Entry point: `functions/index.js`. Each service is a separate module exporting an HTTP function:
- **Active:** github, instagram, league (Riot API), mapbox, sketchfab, spotify, steam
- **Gitignored (proprietary):** disneyplus, hulu, netflix, nintendo, alltrails, linkedin

Functions fetch external APIs, process images (Sharp, FFmpeg, Canvas), store results in Firestore, and upload processed media to GCS bucket `dynamic.scub3d.io`. The AR card and some www widgets fetch from these functions at runtime; the www portfolio pages are mostly pre-rendered.

### Frontend Stacks
- **www** — Pure vanilla JS. No jQuery, no framework, no build step. Uses native modules and `requestAnimationFrame` for animations. Three.js is loaded directly for the globe (`experience_globe.js`, `hackathons_globe.js`, `hikes_globe.js`) and the mapbox widget-style prisms.
- **minesweeper** — Vanilla JS. Three.js for the hero visualization.
- **ar** — A-Frame + jQuery + custom GLSL shaders + Firebase client SDK.

No bundler/transpiler anywhere. Shared vanilla utilities live in `static/www/js/common.js` (cookie helpers, `TextGlitch`, mobile nav, language toggle).

## Key Constraints
- Node.js 16 for Cloud Functions (see `functions/package.json`).
- Font files must be `.woff2` format to avoid HTTPS/CORS issues across subdomains.
- Cloudflare free tier: 3 page rules max, Flexible SSL only (no Full/Strict).
- Enable Cloudflare "Development Mode" when testing site updates to bypass cache.
- `functions/credentials.json` is gitignored — needed for Firebase/GCP auth locally.
- The local Firebase storage emulator seeds `dynamic.scub3d.io` on startup so widgets that read from it work offline.
