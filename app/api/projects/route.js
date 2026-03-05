import { NextResponse } from 'next/server';
import { createProject, listProjects } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = body?.name?.trim() || 'Untitled Trip';
  const project = createProject(name);
  return NextResponse.json({ project });
}
