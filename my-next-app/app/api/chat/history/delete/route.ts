import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../../src/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, sessionId } = body || {};
    if (!userId || !sessionId) return NextResponse.json({ ok: false, error: 'missing' });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('chat_logs')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete session', error);
      return NextResponse.json({ ok: false, error });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Delete session error', e);
    return NextResponse.json({ ok: false, error: e.message || String(e) });
  }
}
