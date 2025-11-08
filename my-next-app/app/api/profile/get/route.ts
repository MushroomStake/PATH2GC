import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE as string | undefined;

const supabase = SUPABASE_SERVICE_ROLE && SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body || {};
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const res = await supabase.from('user_profile').select('*').eq('id', userId).limit(1).maybeSingle();
    if (res.error) {
      console.error('Fetch profile error', res.error);
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    const profile = res.data ?? null;
    // If profile has an avatar path, create a signed URL so the client can display it
    if (profile && profile.avatar_url) {
      try {
        const bucket = 'upload';
        const expiresIn = 60 * 60; // 1 hour
        const signed = await supabase.storage.from(bucket).createSignedUrl(profile.avatar_url, expiresIn);
        if (!signed.error) {
          // attach a short-lived display URL
          profile.signed_avatar_url = signed.data.signedUrl;
        }
      } catch (e) {
        console.error('Failed to create signed avatar URL', e);
      }
    }

    return NextResponse.json({ profile });
  } catch (e: any) {
    console.error('Profile get error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
