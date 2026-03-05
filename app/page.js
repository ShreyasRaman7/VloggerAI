'use client';

import { useEffect, useMemo, useState } from 'react';

const CHUNK = 8 * 1024 * 1024;

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

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [name, setName] = useState('Spain + Italy 2025');
  const [theme, setTheme] = useState('Spain');
  const [prompt, setPrompt] = useState('cinematic, emotional, slight glitch on beat drops');
  const [dropbox, setDropbox] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const active = useMemo(() => projects.find((p) => p.id === activeId), [projects, activeId]);

  const refresh = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data.projects || []);
    if (!activeId && data.projects?.length) setActiveId(data.projects[0].id);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (active?.status === 'processing') refresh();
    }, 3500);
    return () => clearInterval(t);
  }, [active?.status]);

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
      setMsg('Upload complete');
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

  const render = async () => {
    if (!activeId) return;
    setBusy(true);
    setMsg('Rendering... this can take time for large uploads.');
    await fetch('/api/projects/' + activeId, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme, prompt })
    });
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: activeId, theme, customPrompt: prompt })
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.error || 'Render started');
    await refresh();
  };

  return (
    <main className="container">
      <h1>Vlogger AI — TikTok Travel Vlog Generator</h1>
      <p className="small">Drop videos/photos + trend audio, pick Spain/Italy/Custom, and render cinematic 9:16 edits. Supports chunked uploads for large files.</p>

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
          <h3>Projects</h3>
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

          <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFileUpload([...e.dataTransfer.files], false); }}>
            Drag/drop images/videos here
            <div className="small">Or pick files</div>
            <input type="file" multiple accept="image/*,video/*" onChange={(e) => onFileUpload([...e.target.files], false)} />
          </div>

          <div className="drop">
            Upload trend audio (mp3/wav)
            <input type="file" accept="audio/*" onChange={(e) => onFileUpload([...e.target.files], true)} />
          </div>

          <label>Dropbox direct link</label>
          <input value={dropbox} onChange={(e) => setDropbox(e.target.value)} placeholder="https://www.dropbox.com/s/.../file.mp4?dl=0" />
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => importDropbox(false)}>Import Dropbox Media</button>
            <button className="secondary" disabled={busy} onClick={() => importDropbox(true)}>Import Dropbox Audio</button>
          </div>

          <button disabled={busy || !activeId} onClick={render}>Render TikTok Vlog</button>
          {active?.status === 'done' && <a href={`/api/download/${active.id}`}><button>Download Rendered MP4</button></a>}
          {active?.error && <p style={{ color: '#fca5a5' }}>{active.error}</p>}
          <p className="small">{msg}</p>
        </div>
      </section>
    </main>
  );
}
