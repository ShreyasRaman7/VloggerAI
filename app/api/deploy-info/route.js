import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || null,
    ts: Date.now()
  });
}
