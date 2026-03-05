'use client';

import { useState } from 'react';

const DEFAULT_PROMPT = 'Spain + Italy travel dump 2025, Bad Bunny LA MuDANZA energy, cinematic color grade, fast cuts, text pops, emotional ending';

function inferTheme(promptText) {
  const t = (promptText || '').toLowerCase();
  if (t.includes('italy') && !t.includes('spain')) return 'Italy';
  if (t.includes('spain')) return 'Spain';
  return 'Custom';
}

export default function Home() {
  const [dropboxLink, setDropboxLink] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [projectName, setProjectName] = useState('Spain + Italy 2025');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Paste your Dropbox direct file link, tweak prompt, and hit Generate.');
  const [result, setResult] = useState(null);

  const quickGenerate = async () => {
    if (!dropboxLink.trim()) {
      setStatus('Please add a Dropbox direct file link first.');
      return;
    }

    const finalPrompt = prompt.trim() || DEFAULT_PROMPT;
    const theme = inferTheme(finalPrompt);

    setBusy(true);
    setResult(null);
    try {
      setStatus('Creating project...');
      const projectRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() || 'Travel Vlog Project' })
      });
      const projectData = await projectRes.json();
      if (!projectRes.ok) throw new Error(projectData.error || 'Project creation failed');
      const projectId = projectData.project.id;

      setStatus('Importing Dropbox media...');
      const mediaRes = await fetch('/api/import/dropbox', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, url: dropboxLink, isAudio: false })
      });
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) throw new Error(mediaData.error || 'Dropbox import failed');

      setStatus('Starting render setup...');
      const renderRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, theme, customPrompt: finalPrompt })
      });
      const renderData = await renderRes.json();
      if (!renderRes.ok) throw new Error(renderData.error || 'Render start failed');

      setResult({
        projectId,
        theme,
        prompt: finalPrompt,
        note: renderData.note || 'Project prepared successfully.'
      });
      setStatus('Done. Project created and configured.');
    } catch (error) {
      setStatus(`Failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container simpleWrap">
      <h1>Vlogger AI</h1>
      <p className="small">Simple mode: Dropbox link + prompt. Default prompt includes Spain + Italy + La MuDANZA vibe.</p>

      <section className="card simpleCard grid">
        <label>Project name</label>
        <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Spain + Italy 2025" />

        <label>Dropbox media link</label>
        <input
          value={dropboxLink}
          onChange={(e) => setDropboxLink(e.target.value)}
          placeholder="https://www.dropbox.com/s/.../your_video.mp4?dl=0"
        />

        <label>Prompt (leave empty to use default)</label>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={DEFAULT_PROMPT}
        />

        <button disabled={busy} onClick={quickGenerate}>{busy ? 'Working...' : 'Generate Vlog Project'}</button>
        <p className="small">{status}</p>

        {result && (
          <div className="resultBox">
            <strong>Project ready</strong>
            <div className="small">Project ID: {result.projectId}</div>
            <div className="small">Theme: {result.theme}</div>
            <div className="small">Prompt: {result.prompt}</div>
            <div className="small">{result.note}</div>
          </div>
        )}
      </section>
    </main>
  );
}
