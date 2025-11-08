import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE as string | undefined;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn('Missing Supabase server env vars for profile upload route.');
}

const supabase = SUPABASE_SERVICE_ROLE && SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, fileName, base64, contentType } = body || {};
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    if (!userId || !fileName || !base64) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    // Decode base64 to Buffer
    const buf = Buffer.from(base64, 'base64');
    const path = `avatars/${userId}/${Date.now()}_${fileName}`;

    // Upload to bucket named 'upload' (private). We'll return a signed URL for display.
    const bucket = 'upload';
    const uploadRes = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    });

    if (uploadRes.error) {
      console.error('Upload failed', uploadRes.error);
      return NextResponse.json({ error: 'Upload failed', detail: uploadRes.error }, { status: 500 });
    }

    // Create a signed URL valid for 1 hour
    const expiresIn = 60 * 60; // seconds
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signed.error) {
      console.error('Failed to create signed URL', signed.error);
      return NextResponse.json({ error: 'Signed URL creation failed' }, { status: 500 });
    }

    return NextResponse.json({ path, signedUrl: signed.data.signedUrl });
  } catch (e: any) {
    console.error('Profile upload error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
