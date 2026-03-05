# Vlogger AI Web App

A web-first TikTok-style travel vlog app. No Python install is required for the main product flow.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What changed (important)

- Rendering is now **browser-side** (Web APIs + MediaRecorder), so users can export directly from the UI as `.webm`.
- Server routes are used for project/edit metadata + chunked file storage + Dropbox import.
- This avoids requiring Python in your Vercel webapp path.

## Current workflow

1. Create a project
2. Drag/drop media (large files are chunk uploaded for storage)
3. Upload audio
4. Select theme + prompt
5. Click **Render in Browser (WebM)**
6. Download your rendered output

## Dropbox notes

- Best with direct file links (not folder pages).
- Imported Dropbox files are stored for project tracking; browser renderer currently uses files selected in the local browser session.

## Vercel notes

- App is Next.js and serves `/` correctly.
- Server filesystem storage is ephemeral on Vercel (`/tmp`), so durable persistence should later move to Blob/S3 + DB.
