import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { addAsset, mediaFolderForProject } from '@/lib/store';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const MEDIA_EXTS = new Set(['.mp4', '.mov', '.m4v', '.jpg', '.jpeg', '.png', '.webp', '.mp3', '.wav']);

function normalizeDropbox(raw) {
  const url = new URL(raw);
  if (url.hostname.includes('dropbox.com')) {
    url.searchParams.set('dl', '1');
    return url.toString();
  }
  return raw;
}

function inferKind(filePath, contentType, isAudio) {
  const ext = path.extname(filePath).toLowerCase();
  if (isAudio || contentType.includes('audio') || ['.mp3', '.wav'].includes(ext)) return 'audio';
  return 'media';
}

async function saveResponseToFile(response, outPath) {
  const writer = fs.createWriteStream(outPath);
  for await (const chunk of response.body) {
    writer.write(chunk);
  }
  writer.end();
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function importZip(projectId, zipPath, originalUrl) {
  const mediaDir = mediaFolderForProject(projectId);
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropbox_extract_'));
  await execFileAsync('unzip', ['-o', zipPath, '-d', extractDir]);

  const imported = [];
  const stack = [extractDir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      if (!MEDIA_EXTS.has(ext) || ['.mp3', '.wav'].includes(ext)) continue;

      const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const outPath = path.join(mediaDir, `${Date.now()}_${safeName}`);
      fs.copyFileSync(full, outPath);
      const asset = addAsset(projectId, {
        kind: 'media',
        filePath: outPath,
        filename: safeName,
        bytes: fs.statSync(outPath).size,
        source: 'dropbox-folder',
        originalUrl
      });
      imported.push(asset);
    }
  }

  fs.rmSync(extractDir, { recursive: true, force: true });
  return imported;
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
  const contentDisposition = response.headers.get('content-disposition') || '';
  const cdName = /filename="?([^";]+)"?/i.exec(contentDisposition)?.[1];
  const defaultExt = contentType.includes('video') ? '.mp4' : contentType.includes('audio') ? '.mp3' : '.bin';
  const nameGuess = cdName || new URL(normalized).pathname.split('/').pop() || `dropbox${defaultExt}`;
  const safeName = nameGuess.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const outPath = path.join(mediaDir, `${Date.now()}_${safeName}`);

  await saveResponseToFile(response, outPath);

  const isZip = contentType.includes('zip') || safeName.toLowerCase().endsWith('.zip');
  if (isZip) {
    try {
      const assets = await importZip(projectId, outPath, dropboxUrl);
      return NextResponse.json({
        ok: true,
        importedCount: assets.length,
        assets,
        note: assets.length
          ? 'Dropbox folder imported. Building a 60s capcut-style highlight reel from extracted media.'
          : 'ZIP downloaded but no compatible media files were found.'
      });
    } catch (error) {
      return NextResponse.json({ error: `zip import failed: ${error.message}` }, { status: 500 });
    }
  }

  const kind = inferKind(outPath, contentType, isAudio);
  const asset = addAsset(projectId, {
    kind,
    filePath: outPath,
    filename: safeName,
    bytes: fs.statSync(outPath).size,
    source: 'dropbox',
    originalUrl: dropboxUrl
  });

  return NextResponse.json({ ok: true, importedCount: 1, asset, note: 'Media imported successfully.' });
}
