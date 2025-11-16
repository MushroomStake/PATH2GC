import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../src/lib/supabaseServer';

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_URL = process.env.CEREBRAS_API_URL || 'https://api.cerebras.net/v1/generate';
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

function timeoutFetch(url: string, options: any, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function buildTranscript(rows: any[]) {
  const lines: string[] = [];
  for (const r of rows) {
    if (r.user_message) lines.push(`[User${r.user_id ? ' ' + r.user_id : ''} @ ${new Date(r.created_at).toISOString()}] ${r.user_message}`);
    if (r.assistant_response) lines.push(`[Assistant @ ${new Date(r.created_at).toISOString()}] ${r.assistant_response}`);
  }
  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, userId, limit = 40, allowAnalysis = false } = body || {};

    if (!allowAnalysis) {
      return NextResponse.json({ error: 'Analysis not allowed. Set allowAnalysis=true to proceed.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch recent chat logs for session or user
    let q = supabase.from('chat_logs').select('id,created_at,user_message,assistant_response,user_id,metadata').order('created_at', { ascending: true }).limit(limit);
    if (sessionId) q = q.eq('session_id', sessionId);
    else if (userId) q = q.eq('user_id', userId);
    const res = await q;
    if (res.error) {
      console.error('Failed fetching chat_logs for analysis', res.error);
      return NextResponse.json({ error: 'Failed fetching chat logs' }, { status: 500 });
    }
    const rows = res.data || [];
    if (!rows.length) return NextResponse.json({ error: 'No conversation rows found' }, { status: 404 });

    const transcript = buildTranscript(rows);

    if (!CEREBRAS_API_KEY) {
      return NextResponse.json({ error: 'No LLM provider configured (CEREBRAS_API_KEY missing)' }, { status: 500 });
    }

    const system = `You are a conversation analyst. Given the transcript, return a JSON object with keys: summary (one-sentence), intents (array of short intent labels), missing_info (array of facts to ask), clarifying_questions (array of up to 3 short questions), sentiment (one of: positive|neutral|negative|confused), can_answer_directly (boolean). Return only valid JSON.`;
    const userPrompt = `Transcript:\n\n${transcript}\n\nRespond with the requested JSON only.`;

    const bodyObj = {
      model: CEREBRAS_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 400,
      temperature: 0.0,
      stream: false
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers['Authorization'] = `Bearer ${CEREBRAS_API_KEY}`;

    let resp;
    try {
      resp = await timeoutFetch(CEREBRAS_API_URL, { method: 'POST', headers, body: JSON.stringify(bodyObj) }, 12000);
    } catch (e: any) {
      console.error('LLM network error', e?.message || e);
      return NextResponse.json({ error: 'Network error contacting provider' }, { status: 502 });
    }

    const respText = await resp.text().catch(() => '');

    let analysis: any = null;
    try {
      // Try parsing raw text as JSON
      analysis = JSON.parse(respText);
    } catch (e) {
      // If provider returned a wrapped object, try to extract common text fields
      try {
        const j = JSON.parse(respText || '{}');
        // fallback: find a text-like field
        if (typeof j === 'object') {
          const cand = j?.choices?.[0]?.message?.content || j?.choices?.[0]?.text || j?.output?.[0]?.content?.[0]?.text || j?.generated_text;
          if (cand) analysis = JSON.parse(String(cand));
        }
      } catch (ee) {
        // final fallback: return raw text as error
        analysis = { error: 'analysis_parse_failed', raw: respText };
      }
    }

    // Persist analysis into the last chat log's metadata.analysis
    try {
      const lastRow = rows[rows.length - 1];
      const existingMeta = lastRow.metadata || {};
      const nextMeta = { ...existingMeta, analysis };
      await supabase.from('chat_logs').update({ metadata: nextMeta }).eq('id', lastRow.id);
    } catch (e) {
      console.error('Failed to persist analysis', e);
    }

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('Analyze route error', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
