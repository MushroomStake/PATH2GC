import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_URL = process.env.CEREBRAS_API_URL || 'https://api.cerebras.net/v1/generate';

const CANDIDATE_URLS = Array.from(new Set([
  CEREBRAS_API_URL,
  'https://api.cerebras.net/v1/generate',
  'https://api.cerebras.ai/v1/generate',
  // Some providers use /models/<model>/generate
  'https://api.cerebras.net/v1/models/gpt-large/generate',
  'https://api.cerebras.ai/v1/models/gpt-large/generate',
]));

async function tryUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const result: any = { url, attemptedAt: new Date().toISOString() };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CEREBRAS_API_KEY ? { 'Authorization': `Bearer ${CEREBRAS_API_KEY}` } : {}),
      },
      body: JSON.stringify({ prompt: 'ping', context: 'connectivity test', max_tokens: 1 }),
      signal: controller.signal,
    });
    result.ok = resp.ok;
    result.status = resp.status;
    const txt = await resp.text();
    result.bodyPreview = txt ? (txt.length > 1000 ? txt.slice(0, 1000) + '... (truncated)' : txt) : null;
  } catch (err: any) {
    result.ok = false;
    result.error = err?.message || String(err);
  } finally {
    clearTimeout(timeout);
  }
  return result;
}

export async function GET(_req: NextRequest) {
  const results = [] as any[];
  for (const u of CANDIDATE_URLS) {
    try {
      const r = await tryUrl(u);
      results.push(r);
    } catch (e: any) {
      results.push({ url: u, ok: false, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ keyPresent: !!CEREBRAS_API_KEY, results });
}
