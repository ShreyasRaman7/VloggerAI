'use client';

import { useEffect, useMemo, useState } from 'react';

const CHUNK = 8 * 1024 * 1024;
const SIZE = { w: 1080, h: 1920 };

async function chunkUpload({ projectId, file, isAudio = false }) {
  const totalParts = Math.ceil(file.size / CHUNK);
  const uploadId = `${projectId}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  for (let i = 0; i < totalParts; i += 1) {
    const start = i * CHUNK;
    const end = Math.min(file.size, start + CHUNK);
    const blob = file.slice(start, end);

    const form = new FormData();
    form.append('chunk', blob);
    form.append('uploadId', uploadId);
    form.append('projectId', projectId);
    form.append('filename', file.name);
    form.append('partIndex', String(i));
    form.append('totalParts', String(totalParts));
    form.append('totalSize', String(file.size));
    form.append('isAudio', String(isAudio));

    const res = await fetch('/api/upload/chunk', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload failed at chunk ${i + 1}/${totalParts}`);
  }
}

const ext = (name = '') => name.toLowerCase().split('.').pop() || '';
const isVideo = (name) => ['mp4', 'mov', 'webm', 'm4v'].includes(ext(name));

function fitCover(srcW, srcH, dstW, dstH) {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    const h = dstH;
    const w = h * srcAspect;
    return { x: (dstW - w) / 2, y: 0, w, h };
  }
  const w = dstW;
  const h = w / srcAspect;
  return { x: 0, y: (dstH - h) / 2, w, h };
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function exportInBrowser({ mediaFiles, audioFile, theme, prompt, onProgress }) {
  if (!mediaFiles.length) throw new Error('Select at least one image/video for browser render.');

  const canvas = document.createElement('canvas');
  canvas.width = SIZE.w;
  canvas.height = SIZE.h;
  const ctx = canvas.getContext('2d', { alpha: false });

  const stream = canvas.captureStream(30);

  let audioCtx;
  let bufferSource;
  if (audioFile) {
    audioCtx = new AudioContext();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const destination = audioCtx.createMediaStreamDestination();
    bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(destination);
    bufferSource.connect(audioCtx.destination);
    destination.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }

  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data);

  let running = true;
  const drawOverlay = (title, sub) => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, SIZE.h - 350, SIZE.w, 350);
    ctx.font = 'bold 72px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(title, 70, SIZE.h - 210);
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(sub, 70, SIZE.h - 140);
  };

  const grade = (imgData) => {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (theme === 'Spain') {
        d[i] = Math.min(255, r * 1.09);
        d[i + 1] = Math.min(255, g * 1.03);
        d[i + 2] = Math.max(0, b * 0.92);
      } else if (theme === 'Italy') {
        d[i] = Math.max(0, r * 0.92);
        d[i + 1] = Math.min(255, g * 1.05);
        d[i + 2] = Math.min(255, b * 1.08);
      }
    }
  };

  const labels = theme === 'Spain'
    ? ['Madrid vibes 🇪🇸', '¡Viva España!', '2025 memories', '#travel #fyp']
    : theme === 'Italy'
      ? ['Ciao Roma 🇮🇹', 'Bellissimo!', 'Grazie 2025', '#travel #reels']
      : ['Travel dump', '2025 recap', '#fyp'];

  recorder.start(250);
  if (bufferSource) bufferSource.start(0);

  for (let i = 0; i < mediaFiles.length; i += 1) {
    if (!running) break;
    onProgress?.(`Rendering ${i + 1}/${mediaFiles.length}: ${mediaFiles[i].name}`);

    const file = mediaFiles[i];
    const url = URL.createObjectURL(file);
    const title = labels[i % labels.length];
    const subtitle = prompt ? prompt.slice(0, 36) : 'TikTok Travel Vlog';

    if (isVideo(file.name)) {
      const v = document.createElement('video');
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      await v.play().catch(() => {});

      const start = performance.now();
      const maxMs = theme === 'Spain' ? 2400 : 3200;
      while (performance.now() - start < maxMs && !v.ended) {
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, SIZE.w, SIZE.h);
        const box = fitCover(v.videoWidth || 1080, v.videoHeight || 1920, SIZE.w, SIZE.h);
        ctx.drawImage(v, box.x, box.y, box.w, box.h);
        const frame = ctx.getImageData(0, 0, SIZE.w, SIZE.h);
        grade(frame);
        ctx.putImageData(frame, 0, 0);
        drawOverlay(title, subtitle);
        await wait(1000 / 30);
      }
      v.pause();
    } else {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const dur = theme === 'Spain' ? 2200 : 3200;
      const start = performance.now();
      while (performance.now() - start < dur) {
        const t = (performance.now() - start) / dur;
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, SIZE.w, SIZE.h);
        const box = fitCover(img.width, img.height, SIZE.w, SIZE.h);
        const z = 1 + 0.08 * t;
        const w = box.w * z;
        const h = box.h * z;
        const x = box.x - (w - box.w) / 2;
        const y = box.y - (h - box.h) / 2;
        ctx.drawImage(img, x, y, w, h);
        const frame = ctx.getImageData(0, 0, SIZE.w, SIZE.h);
        grade(frame);
        ctx.putImageData(frame, 0, 0);
        drawOverlay(title, subtitle);
        await wait(1000 / 30);
      }
    }

    URL.revokeObjectURL(url);
  }

  recorder.stop();
  await new Promise((resolve) => { recorder.onstop = resolve; });
  running = false;

  const blob = new Blob(chunks, { type: 'video/webm' });
  return URL.createObjectURL(blob);
}

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [name, setName] = useState('Spain + Italy 2025');
  const [theme, setTheme] = useState('Spain');
  const [prompt, setPrompt] = useState('cinematic, emotional, slight glitch on beat drops');
  const [dropbox, setDropbox] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [localMedia, setLocalMedia] = useState([]);
  const [localAudio, setLocalAudio] = useState(null);
  const [renderUrl, setRenderUrl] = useState('');

  const active = useMemo(() => projects.find((p) => p.id === activeId), [projects, activeId]);

  const refresh = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data.projects || []);
    if (!activeId && data.projects?.length) setActiveId(data.projects[0].id);
  };

  useEffect(() => { refresh(); }, []);

  const createProject = async () => {
    setBusy(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    setBusy(false);
    await refresh();
    setActiveId(data.project.id);
  };

  const onFileUpload = async (files, isAudio = false) => {
    if (!activeId) return;
    setBusy(true);
    setMsg(`Uploading ${files.length} file(s)...`);
    try {
      for (const f of files) await chunkUpload({ projectId: activeId, file: f, isAudio });
      setMsg('Upload complete (project metadata saved).');
      await refresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const importDropbox = async (isAudio = false) => {
    if (!activeId || !dropbox) return;
    setBusy(true);
    setMsg('Importing Dropbox file...');
    const res = await fetch('/api/import/dropbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: activeId, url: dropbox, isAudio })
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.error || data.note || 'Dropbox import completed');
    await refresh();
  };

  const browserRender = async () => {
    setBusy(true);
    setMsg('Browser rendering started... keep tab open for best stability.');
    try {
      const url = await exportInBrowser({
        mediaFiles: localMedia,
        audioFile: localAudio,
        theme,
        prompt,
        onProgress: setMsg
      });
      if (renderUrl) URL.revokeObjectURL(renderUrl);
      setRenderUrl(url);
      setMsg('Render complete (WebM).');
    } catch (e) {
      setMsg(`Render failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container">
      <h1>Vlogger AI — Web App (No Python install required)</h1>
      <p className="small">Render happens in your browser using Web APIs. Server APIs keep project/edit metadata and uploaded assets.</p>

      <section className="card grid two">
        <div>
          <label>New project name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="row" style={{ alignItems: 'end' }}>
          <button disabled={busy} onClick={createProject}>Create Project</button>
          <button className="secondary" onClick={refresh}>Refresh</button>
        </div>
      </section>

      <section className="card grid two">
        <div>
          <h3>Projects (stored metadata)</h3>
          {(projects || []).map((p) => (
            <div key={p.id} className="projectItem" onClick={() => setActiveId(p.id)} style={{ cursor: 'pointer', outline: p.id === activeId ? '2px solid #4f46e5' : 'none' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{p.name}</strong>
                <span className="badge">{p.status}</span>
              </div>
              <div className="small">{p.id}</div>
            </div>
          ))}
        </div>

        <div className="grid">
          <h3>Active project tools</h3>
          <label>Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option>Spain</option>
            <option>Italy</option>
            <option>Custom</option>
          </select>
          <label>Prompt override</label>
          <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />

          <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const arr = [...e.dataTransfer.files]; setLocalMedia((m) => [...m, ...arr]); onFileUpload(arr, false); }}>
            Drag/drop images/videos here
            <div className="small">or pick files (also used for local browser render)</div>
            <input type="file" multiple accept="image/*,video/*" onChange={(e) => { const arr = [...e.target.files]; setLocalMedia((m) => [...m, ...arr]); onFileUpload(arr, false); }} />
          </div>

          <div className="drop">
            Upload trend audio (mp3/wav)
            <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0] || null; setLocalAudio(f); if (f) onFileUpload([f], true); }} />
          </div>

          <label>Dropbox direct link (import to project storage)</label>
          <input value={dropbox} onChange={(e) => setDropbox(e.target.value)} placeholder="https://www.dropbox.com/s/.../file.mp4?dl=0" />
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => importDropbox(false)}>Import Dropbox Media</button>
            <button className="secondary" disabled={busy} onClick={() => importDropbox(true)}>Import Dropbox Audio</button>
          </div>

          <button disabled={busy || !localMedia.length} onClick={browserRender}>Render in Browser (WebM)</button>
          {renderUrl && (
            <div className="row">
              <a href={renderUrl} download={`vlogger-ai-${Date.now()}.webm`}><button>Download Rendered WebM</button></a>
              <video src={renderUrl} controls style={{ width: 200, borderRadius: 12 }} />
            </div>
          )}

          <p className="small">Local render sources loaded: {localMedia.length} media file(s){localAudio ? ', audio ready' : ''}.</p>
          <p className="small">{msg}</p>
          {active && <p className="small">Active project: {active.name}</p>}
        </div>
      </section>
    </main>
  );
}
