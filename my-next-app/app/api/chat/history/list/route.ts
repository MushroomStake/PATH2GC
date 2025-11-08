import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../../src/lib/supabaseServer';

// Return recent chat sessions for a user (most recent first)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body || {};
    if (!userId) return NextResponse.json({ sessions: [] });

    const supabase = getSupabaseAdmin();

    // Fetch recent session ids and a preview (latest assistant_response or user_message)
    const { data, error } = await supabase
      .from('chat_logs')
      .select('session_id,user_message,assistant_response,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Failed to fetch chat history list', error);
      return NextResponse.json({ sessions: [] });
    }

    // Group by session_id and pick the latest row per session
    const map = new Map<string, any>();
    for (const row of (data || [])) {
      const sid = row.session_id || 'session';
      if (!map.has(sid)) map.set(sid, row);
    }

    const sessions = Array.from(map.entries()).map(([session_id, row]) => ({
      session_id,
      preview: (row.assistant_response || row.user_message || '').slice(0, 200),
      last_at: row.created_at,
    })).sort((a,b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()).slice(0, 50);

    return NextResponse.json({ sessions });
  } catch (e: any) {
    console.error('Chat history list error', e);
    return NextResponse.json({ sessions: [] });
  }
}
