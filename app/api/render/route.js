import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { projectId, theme, customPrompt } = body;

  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });

  updateProject(projectId, {
    status: 'done',
    theme: theme || project.theme || 'Spain',
    prompt: customPrompt || '',
    error: null,
    outputPath: null,
    note: 'Server-side Python rendering is disabled. Use browser render in UI to export WebM without Python install.'
  });

  return NextResponse.json({
    ok: true,
    status: 'done',
    note: 'No Python install required. Rendering now runs in-browser from the web UI.'
  });
}
