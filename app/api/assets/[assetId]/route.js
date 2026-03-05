import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getAsset } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(_req, { params }) {
  const asset = getAsset(params.assetId);
  if (!asset) return NextResponse.json({ error: 'asset not found' }, { status: 404 });
  if (!fs.existsSync(asset.filePath)) return NextResponse.json({ error: 'file missing' }, { status: 404 });

  const ext = path.extname(asset.filePath).toLowerCase();
  const type = ['.jpg', '.jpeg'].includes(ext)
    ? 'image/jpeg'
    : ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.mp4'
          ? 'video/mp4'
          : ext === '.mov'
            ? 'video/quicktime'
            : ext === '.mp3'
              ? 'audio/mpeg'
              : 'application/octet-stream';

  const data = fs.readFileSync(asset.filePath);
  return new NextResponse(data, {
    headers: {
      'content-type': type,
      'content-disposition': `inline; filename="${asset.filename || path.basename(asset.filePath)}"`
    }
  });
}
