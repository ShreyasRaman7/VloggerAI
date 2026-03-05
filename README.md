# Vlogger AI Web App

Web app for creating TikTok-style travel vlogs from drag-drop uploads or Dropbox links.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Notes for Vercel

- This is a Next.js app and removes the 404 issue by providing a real `/` route.
- Uploads/renders are stored in local filesystem (`.data` locally, `/tmp/vlogger-ai` on Vercel).
- Vercel serverless storage is ephemeral, so completed renders are temporary unless you later add durable storage (Vercel Blob/S3/Postgres).
- Python rendering uses `tiktok_travel_vlog_generator.py`; ensure runtime image includes Python + moviepy stack.

## Supported workflow

1. Create a project
2. Upload media via drag-drop (chunked upload for large files)
3. Upload an audio track (required)
4. Pick theme and custom prompt
5. Render and download output MP4

Dropbox import supports direct file links best. Shared folder links are less reliable depending on Dropbox response format.
