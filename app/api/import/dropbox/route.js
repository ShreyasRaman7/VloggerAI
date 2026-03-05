import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { addAsset, mediaFolderForProject } from '@/lib/store';

export const runtime = 'nodejs';

function normalizeDropbox(raw) {
  const url = new URL(raw);
  if (url.hostname.includes('dropbox.com')) {
    url.searchParams.set('dl', '1');
    return url.toString();
  }
  return raw;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const projectId = body?.projectId;
  const dropboxUrl = body?.url;
  const isAudio = Boolean(body?.isAudio);

  if (!projectId || !dropboxUrl) {
    return NextResponse.json({ error: 'projectId and url required' }, { status: 400 });
  }

  const normalized = normalizeDropbox(dropboxUrl);
  const response = await fetch(normalized);
  if (!response.ok || !response.body) {
    return NextResponse.json({ error: `unable to download from Dropbox: ${response.status}` }, { status: 400 });
  }

  const mediaDir = mediaFolderForProject(projectId);
  const contentType = response.headers.get('content-type') || '';
  const extFromType = contentType.includes('video') ? '.mp4' : contentType.includes('audio') ? '.mp3' : '.bin';
  const nameGuess = new URL(normalized).pathname.split('/').pop() || `dropbox${extFromType}`;
  const safeName = nameGuess.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const outPath = path.join(mediaDir, `${Date.now()}_${safeName}`);

  const writer = fs.createWriteStream(outPath);
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    writer.write(chunk);
  }
  writer.end();

  const kind = isAudio || contentType.includes('audio') ? 'audio' : 'media';
  const asset = addAsset(projectId, {
    kind,
    filePath: outPath,
    filename: safeName,
    bytes,
    source: 'dropbox',
    originalUrl: dropboxUrl
  });

  return NextResponse.json({ ok: true, asset, note: 'For Dropbox folder links, use a direct file link or upload files via drag-and-drop for best reliability.' });
}
