'use client';

import { useState } from 'react';

const DEFAULT_PROMPT = 'Spain + Italy highlights, capcut-style travel template, Bad Bunny LA MuDANZA energy, clean fast cuts and cinematic color';
const WIDTH = 1080;
const HEIGHT = 1920;
const TARGET_SECONDS = 60;
const MAX_MEDIA_LOAD = 64;
const CHUNK_SIZE = 8 * 1024 * 1024;

function inferTheme(promptText) {
  const t = (promptText || '').toLowerCase();
  if (t.includes('italy') && !t.includes('spain')) return 'Italy';
  if (t.includes('spain') && !t.includes('italy')) return 'Spain';
  if (t.includes('spain') && t.includes('italy')) return 'SpainItaly';
  return 'Custom';
}

function isImageAsset(asset) {
  return asset.mime?.startsWith('image') || /\.(jpg|jpeg|png|webp)$/i.test(asset.filename || '');
}

function evenSample(items, count) {
  if (count <= 0 || !items.length) return [];
  if (count >= items.length) return [...items];
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor((i * items.length) / count);
    picked.push(items[idx]);
  }
  return picked;
}

function buildHighlightPlan(assets, promptText) {
  const energy = /fast|hype|energetic|hard|glitch|viral/i.test(promptText) ? 'high' : 'balanced';
  const targetSlots = energy === 'high' ? 34 : 28;

  const ordered = [...assets].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const videos = ordered.filter((a) => !isImageAsset(a));
  const photos = ordered.filter((a) => isImageAsset(a));

  // Guarantee strong motion in final vlog when user uploads many videos (e.g. 10 clips)
  const mustHaveVideos = videos.length >= 10 ? 10 : Math.min(videos.length, Math.max(6, Math.floor(targetSlots * 0.35)));
  const chosenVideos = evenSample(videos, mustHaveVideos);
  const chosenPhotos = evenSample(photos, Math.max(0, targetSlots - chosenVideos.length));

  const interleaved = [];
  const maxLen = Math.max(chosenVideos.length, chosenPhotos.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (chosenVideos[i]) interleaved.push(chosenVideos[i]);
    if (chosenPhotos[i]) interleaved.push(chosenPhotos[i]);
  }

  if (!interleaved.length) return evenSample(ordered, Math.min(targetSlots, ordered.length));
  return interleaved.slice(0, MAX_MEDIA_LOAD);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function drawCoverFrame(ctx, img, t, dur, theme) {
  const p = Math.min(1, t / dur);
  const scale = 1.06 + p * 0.08;
  const sw = img.width / scale;
  const sh = img.height / scale;
  const sx = (img.width - sw) * p * 0.7;
  const sy = (img.height - sh) * (1 - p) * 0.3;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = theme === 'Italy' ? 'rgba(10,40,55,0.14)' : 'rgba(65,30,15,0.12)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawOverlayText(ctx, title, subtitle) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(50, HEIGHT - 430, WIDTH - 100, 300);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px Inter, Arial';
  ctx.fillText(title, 80, HEIGHT - 280);
  ctx.font = '600 44px Inter, Arial';
  ctx.fillText(subtitle, 80, HEIGHT - 200);
}

async function loadAsset(asset) {
  const res = await fetch(`/api/assets/${asset.id}`);
  if (!res.ok) throw new Error(`Failed loading ${asset.filename}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { ...asset, blobUrl: url, mime: blob.type || '' };
}

export default function Home() {
  const [dropboxLink, setDropboxLink] = useState('');
  const [manualFiles, setManualFiles] = useState([]);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [projectName, setProjectName] = useState('Spain + Italy Highlights');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Use Dropbox link or upload files directly, then generate your 60s highlight reel.');
  const [downloadUrl, setDownloadUrl] = useState('');

  const uploadFileInChunks = async (file, projectId) => {
    const uploadId = `${projectId}_${file.name}_${file.size}_${Date.now()}`;
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
      const start = partIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = file.slice(start, end);

      const form = new FormData();
      form.append('chunk', chunk, file.name);
      form.append('uploadId', uploadId);
      form.append('projectId', projectId);
      form.append('filename', file.name);
      form.append('partIndex', String(partIndex));
      form.append('totalParts', String(totalParts));
      form.append('totalSize', String(file.size));

      const res = await fetch('/api/upload/chunk', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed for ${file.name}`);
    }
  };

  const renderHighlights = async (assets, promptText) => {
    const mediaAssets = assets.filter((a) => a.kind === 'media');
    if (!mediaAssets.length) throw new Error('No media found. Add Dropbox link or upload files manually.');

    const plan = buildHighlightPlan(mediaAssets, promptText);
    const loaded = [];
    for (const a of plan) {
      try {
        loaded.push(await loadAsset(a));
      } catch {
        // skip unreadable files
      }
    }
    if (!loaded.length) throw new Error('Unable to load imported media files.');

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const theme = inferTheme(promptText);
    const subtitles = theme === 'SpainItaly'
      ? ['Madrid → Roma', 'Costa vibes', '2025 recap']
      : theme === 'Italy'
        ? ['Ciao Italia', 'Amalfi moments', 'Bellissimo 2025']
        : ['Viva España', 'Sunset energy', 'Trip highlights'];

    recorder.start(1000);
    const clipDur = Math.max(1.6, Math.min(2.8, TARGET_SECONDS / loaded.length));
    const start = performance.now();
    let subtitleIdx = 0;

    for (const file of loaded) {
      if ((performance.now() - start) / 1000 >= TARGET_SECONDS) break;

      if (isImageAsset(file)) {
        const img = new Image();
        img.src = file.blobUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const t0 = performance.now();
        while ((performance.now() - t0) / 1000 < clipDur) {
          const t = (performance.now() - t0) / 1000;
          drawCoverFrame(ctx, img, t, clipDur, theme);
          if (t < 1.2) drawOverlayText(ctx, 'Vlogger AI', subtitles[subtitleIdx % subtitles.length]);
          await sleep(16);
        }
      } else {
        const v = document.createElement('video');
        v.src = file.blobUrl;
        v.muted = true;
        v.playsInline = true;
        await v.play().catch(() => {});

        const t0 = performance.now();
        while ((performance.now() - t0) / 1000 < clipDur && !v.ended) {
          ctx.clearRect(0, 0, WIDTH, HEIGHT);
          ctx.drawImage(v, 0, 0, WIDTH, HEIGHT);
          ctx.fillStyle = theme === 'Italy' ? 'rgba(0,60,80,0.12)' : 'rgba(90,40,20,0.12)';
          ctx.fillRect(0, 0, WIDTH, HEIGHT);
          if (((performance.now() - t0) / 1000) < 1.1) drawOverlayText(ctx, 'Travel Dump', subtitles[subtitleIdx % subtitles.length]);
          await sleep(16);
        }
        v.pause();
      }
      subtitleIdx += 1;
    }

    recorder.stop();
    await new Promise((resolve) => { recorder.onstop = resolve; });

    loaded.forEach((x) => URL.revokeObjectURL(x.blobUrl));
    return URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
  };

  const generate = async () => {
    if (!dropboxLink.trim() && manualFiles.length === 0) {
      return setStatus('Add a Dropbox link or upload files first.');
    }

    setBusy(true);
    setDownloadUrl('');
    const finalPrompt = prompt.trim() || DEFAULT_PROMPT;

    try {
      setStatus('Creating project...');
      const pRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() || 'Travel Highlight Reel' })
      });
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData.error || 'Project creation failed');
      const projectId = pData.project.id;

      let importedCount = 0;
      if (dropboxLink.trim()) {
        setStatus('Trying Dropbox import...');
        const importRes = await fetch('/api/import/dropbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId, url: dropboxLink.trim() })
        });
        const importData = await importRes.json();
        if (importRes.ok) {
          importedCount += Number(importData.importedCount || 0);
        } else if (!manualFiles.length) {
          throw new Error(importData.error || 'Dropbox import failed and no fallback files uploaded.');
        }
      }

      if (manualFiles.length) {
        setStatus(`Uploading ${manualFiles.length} local file(s) as fallback/boost...`);
        for (let i = 0; i < manualFiles.length; i += 1) {
          setStatus(`Uploading ${i + 1}/${manualFiles.length}: ${manualFiles[i].name}`);
          await uploadFileInChunks(manualFiles[i], projectId);
          importedCount += 1;
        }
      }

      setStatus('Scoring highlights + assembling 60s vlog...');
      const projectRes = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectRes.json();
      if (!projectRes.ok) throw new Error(projectData.error || 'Project fetch failed');

      const assets = projectData.project.assetsMeta || [];
      const videoCount = assets.filter((a) => a.kind === 'media' && !/\.(jpg|jpeg|png|webp)$/i.test(a.filename || '')).length;
      if (videoCount < 3) {
        setStatus('Warning: very few videos found. Upload more clips for the cleanest 1-minute vlog pacing.');
      }

      const url = await renderHighlights(assets, finalPrompt);
      setDownloadUrl(url);
      setStatus(`Done. ${importedCount} file(s) ready. Reel generated with smart highlight selection and video-priority pacing.`);
    } catch (e) {
      setStatus(`Failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container simpleWrap">
      <h1>Vlogger AI — Quick Reel</h1>
      <p className="small">One-shot mode: Dropbox first, local upload fallback, then auto-cut a clean 60s vertical vlog.</p>

      <section className="card simpleCard grid">
        <label>Project name</label>
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />

        <label>Dropbox file/folder share link (optional if uploading files)</label>
        <input
          value={dropboxLink}
          onChange={(e) => setDropboxLink(e.target.value)}
          placeholder="https://www.dropbox.com/scl/fo/..."
        />

        <label>Fallback manual upload (images/videos)</label>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => setManualFiles(Array.from(e.target.files || []))}
        />
        <p className="small">Selected: {manualFiles.length} file(s). If Dropbox ZIP fails, these are used automatically.</p>

        <label>Prompt (empty = Spain+Italy+La MuDANZA default)</label>
        <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={DEFAULT_PROMPT} />

        <button disabled={busy} onClick={generate}>{busy ? 'Generating...' : 'Generate 60s Vlog'}</button>
        <p className="small">{status}</p>

        {downloadUrl && (
          <a href={downloadUrl} download="vlogger_ai_highlight.webm">
            <button className="secondary">Download highlight reel</button>
          </a>
        )}
      </section>
    </main>
  );
}
