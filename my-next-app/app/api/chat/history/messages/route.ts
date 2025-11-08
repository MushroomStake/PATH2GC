import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../../src/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body || {};
    if (!sessionId) return NextResponse.json({ messages: [] });

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('chat_logs')
      .select('user_message,assistant_response,source_meta,path,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch chat messages', error);
      return NextResponse.json({ messages: [] });
    }

    const messages = (data || []).map((r: any) => ({
      user_message: r.user_message,
      assistant_response: r.assistant_response,
      source_meta: r.source_meta,
      path: r.path,
      created_at: r.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (e: any) {
    console.error('Chat history messages error', e);
    return NextResponse.json({ messages: [] });
  }
}
