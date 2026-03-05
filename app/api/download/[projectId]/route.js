import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getProject } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(_, { params }) {
  const project = getProject(params.projectId);
  if (!project?.outputPath || !fs.existsSync(project.outputPath)) {
    return NextResponse.json({ error: 'render output not found' }, { status: 404 });
  }

  const stream = fs.createReadStream(project.outputPath);
  return new NextResponse(stream, {
    headers: {
      'content-type': 'video/mp4',
      'content-disposition': `attachment; filename="${path.basename(project.outputPath)}"`
    }
  });
}
