# Vlogger AI Web App

A web-first TikTok-style travel vlog app with a **quick CapCut-style template flow**.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quick flow (what you asked for)

1. Paste a Dropbox share link (single file or folder/zip link)
2. Add a text prompt (or leave blank for default Spain+Italy+La MuDANZA vibe)
3. Click **Generate 60s Vlog**
4. App imports media first, then auto-cuts a ~1 minute 9:16 highlight reel
5. Download generated `.webm`

## Defaults + templates

- Default prompt: Spain + Italy + Bad Bunny LA MuDANZA energy
- Prompt still controls feel (Spain warm, Italy teal, mixed trip recap)
- Text overlays and quick cuts are applied template-style for cleaner output

## Dropbox behavior

- File links are imported directly.
- Folder links that download as ZIP are extracted server-side and all supported media files are imported.
- Supported media: `.mp4 .mov .m4v .jpg .jpeg .png .webp`

## Vercel note

- Vercel filesystem is ephemeral (`/tmp`).
- For long-term storage/history, migrate media + metadata to durable services (Blob/S3 + DB).
