import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/store';

export async function GET(_, { params }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const project = updateProject(params.id, body);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ project });
}
