import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../src/lib/supabaseServer';

// Return top user messages from chat_logs to surface as quick questions.
export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    // Group identical user_message values and return the most frequent ones.
    const { data, error } = await supabase
      .from('chat_logs')
      .select('user_message, user_id')
      .not('user_message', 'is', null)
      .limit(500);

    if (error) {
      console.error('Failed to fetch chat_logs for suggestions', error);
      return NextResponse.json({ suggestions: [] });
    }

    // Build a frequency map, excluding messages from users who opted into anonymous mode.
    const counts: Record<string, number> = {};
    // Collect user_ids to check anonymous flags
    const userIds = new Set<string>();
    for (const row of (data || [])) {
      const uid = (row as any).user_id as string | null;
      if (uid) userIds.add(uid);
    }

    // Fetch profiles for these users to see who has is_anonymous=true
    const anonMap: Record<string, boolean> = {};
    if (userIds.size > 0) {
      const ids = Array.from(userIds);
      const pRes = await supabase.from('user_profile').select('id,is_anonymous').in('id', ids);
      if (!pRes.error && Array.isArray(pRes.data)) {
        for (const p of pRes.data as any[]) {
          anonMap[p.id] = !!p.is_anonymous;
        }
      }
    }

    for (const row of (data || [])) {
      const msg = (row as any).user_message as string;
      const uid = (row as any).user_id as string | null;
      if (!msg) continue;
      // If user opted into anonymous mode, skip their messages for public suggestions
      if (uid && anonMap[uid]) continue;
      const key = msg.trim();
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }

    const suggestions = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([text, _]) => ({ text }));

    return NextResponse.json({ suggestions });
  } catch (e: any) {
    console.error('Suggestions route error', e);
    return NextResponse.json({ suggestions: [] });
  }
}
