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

## 404 NOT_FOUND on Vercel (important)

If Vercel shows `NOT_FOUND` and deployment source points to an old commit (for example `Initialize repository`), your latest app changes are not what production is serving.

Fix:

1. Merge/push latest commits to your production branch.
2. In **Vercel → Project Settings → Git**, verify **Production Branch** is set correctly.
3. Redeploy from the latest commit.
4. Verify diagnostics endpoints:
   - `/api/health`
   - `/api/deploy-info` (shows active commit SHA/branch/environment)


## Simple UI mode

The homepage now focuses on a minimal flow:

1. Paste Dropbox direct media link
2. Enter prompt (or leave empty to use default)
3. Click **Generate Vlog Project**

Default prompt is prefilled with Spain + Italy + Bad Bunny **LA MuDANZA** vibe so you can run quickly without manual setup.
