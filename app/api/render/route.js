import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getPaths, getProject, updateProject } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { projectId, theme, customPrompt } = body;

  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  const audio = project.assetsMeta.find((a) => a.kind === 'audio');
  if (!audio) return NextResponse.json({ error: 'upload or import an audio file first' }, { status: 400 });

  const media = project.assetsMeta.filter((a) => a.kind === 'media');
  if (!media.length) return NextResponse.json({ error: 'upload at least one image/video' }, { status: 400 });

  const paths = getPaths();
  fs.mkdirSync(paths.outputs, { recursive: true });
  const outPath = path.join(paths.outputs, `${projectId}_${Date.now()}.mp4`);

  updateProject(projectId, { status: 'processing', error: null, theme: theme || 'Spain', prompt: customPrompt || '' });

  const cmd = [
    path.join(process.cwd(), 'tiktok_travel_vlog_generator.py'),
    '--folder', path.dirname(media[0].filePath),
    '--theme', theme || 'Spain',
    '--audio_path', audio.filePath,
    '--output', outPath,
    '--custom', customPrompt || ''
  ];

  const py = spawn('python3', cmd, { cwd: process.cwd() });

  let stderr = '';
  py.stderr.on('data', (d) => { stderr += d.toString(); });

  py.on('close', (code) => {
    if (code === 0) {
      updateProject(projectId, { status: 'done', outputPath: outPath });
    } else {
      updateProject(projectId, { status: 'failed', error: stderr.slice(-4000) || `python exit ${code}` });
    }
  });

  return NextResponse.json({ ok: true, status: 'processing' });
}
