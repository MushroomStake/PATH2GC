import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE as string | undefined;

const supabase = SUPABASE_SERVICE_ROLE && SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, contactNumber, avatarUrl, avatarPath, isAnonymous } = body || {};
    if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // Prefer explicit storage path (avatarPath). If not provided, fall back to avatarUrl.
    const avatar_storage_path = avatarPath ?? (typeof avatarUrl === 'string' && !avatarUrl.startsWith('http') ? avatarUrl : null);

    const now = new Date().toISOString();
    const upsertObj: any = {
      id: userId,
      name: name ?? null,
      contact_number: contactNumber ?? null,
      avatar_url: avatar_storage_path ?? null,
      is_anonymous: !!isAnonymous,
      updated_at: now,
    };

    console.log('Profile update request body:', { userId, name, contactNumber, avatarUrl, avatarPath, isAnonymous });

    const res = await supabase.from('user_profile').upsert(upsertObj).select('*');
    if (res.error) {
      console.error('Upsert profile error', res.error);
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: res.data?.[0] ?? null });
  } catch (e: any) {
    console.error('Profile update error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
