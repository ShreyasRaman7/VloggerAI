import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { addAsset, getPaths, mediaFolderForProject } from '@/lib/store';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 1024 * 1024 * 1024 * 2; // 2GB safety cap

export async function POST(req) {
  const form = await req.formData();
  const chunk = form.get('chunk');
  const uploadId = String(form.get('uploadId') || '');
  const projectId = String(form.get('projectId') || '');
  const filename = String(form.get('filename') || 'file.bin');
  const partIndex = Number(form.get('partIndex') || 0);
  const totalParts = Number(form.get('totalParts') || 1);
  const totalSize = Number(form.get('totalSize') || 0);
  const isAudio = String(form.get('isAudio') || 'false') === 'true';

  if (!chunk || !projectId || !uploadId) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }
  if (totalSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'file too large for this deployment limit (2GB cap)' }, { status: 400 });
  }

  const paths = getPaths();
  fs.mkdirSync(paths.chunks, { recursive: true });
  const chunkDir = path.join(paths.chunks, uploadId);
  fs.mkdirSync(chunkDir, { recursive: true });

  const buf = Buffer.from(await chunk.arrayBuffer());
  fs.writeFileSync(path.join(chunkDir, `${partIndex}.part`), buf);

  if (partIndex + 1 < totalParts) {
    return NextResponse.json({ ok: true, partial: true });
  }

  const mediaDir = mediaFolderForProject(projectId);
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const outPath = path.join(mediaDir, `${Date.now()}_${safeName}`);

  const out = fs.createWriteStream(outPath);
  for (let i = 0; i < totalParts; i += 1) {
    const p = path.join(chunkDir, `${i}.part`);
    if (!fs.existsSync(p)) {
      out.close();
      return NextResponse.json({ error: `missing chunk ${i}` }, { status: 400 });
    }
    out.write(fs.readFileSync(p));
  }
  out.end();

  fs.rmSync(chunkDir, { recursive: true, force: true });

  const ext = path.extname(safeName).toLowerCase();
  const kind = isAudio || ['.mp3', '.wav', '.m4a', '.aac'].includes(ext) ? 'audio' : 'media';
  const asset = addAsset(projectId, {
    kind,
    filePath: outPath,
    filename: safeName,
    bytes: totalSize,
    source: 'upload'
  });

  return NextResponse.json({ ok: true, partial: false, asset });
}
