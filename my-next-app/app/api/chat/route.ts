import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
// Provider: Cerebras
// NOTE: Assumption: Cerebras exposes a simple REST endpoint that accepts a POST with an auth Bearer token.
// If your Cerebras provider uses a different shape/path, set `CEREBRAS_API_URL` in your environment to the correct URL.
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_URL = process.env.CEREBRAS_API_URL || 'https://api.cerebras.net/v1/generate';

const supabase = SUPABASE_SERVICE_ROLE && SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  : null;

// Detection cache for provider endpoint/payload/auth shape. Kept in-memory for dev.
let detectedConfig: null | {
  url: string;
  authHeader: 'authorization' | 'x-api-key';
  payloadStyle: 'prompt' | 'input' | 'messages' | 'openai';
} = null;

const CANDIDATE_URLS = Array.from(new Set([
  CEREBRAS_API_URL,
  'https://api.cerebras.ai/v1/generate',
  'https://api.cerebras.net/v1/generate',
  'https://api.cerebras.ai/v1/models/gpt-large/generate',
  'https://api.cerebras.net/v1/models/gpt-large/generate',
]));

async function tryFetchWithTimeout(url: string, options: any, timeoutMs = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function detectProvider() {
  if (detectedConfig) return detectedConfig;
  if (!CEREBRAS_API_KEY) return null;

  const authOptions = [
    { headerName: 'Authorization', headerValue: `Bearer ${CEREBRAS_API_KEY}`, key: 'authorization' as const },
    { headerName: 'x-api-key', headerValue: CEREBRAS_API_KEY, key: 'x-api-key' as const },
  ];

  const payloadStyles: Array<{ style: 'prompt' | 'input' | 'messages' | 'openai'; body: any }> = [
    { style: 'prompt', body: { prompt: 'ping', context: 'test', max_tokens: 1 } },
    { style: 'input', body: { input: 'ping' } },
    { style: 'messages', body: { messages: [{ role: 'user', content: 'ping' }] } },
    { style: 'openai', body: { model: 'gpt-large', prompt: 'ping', max_tokens: 1 } },
  ];

  for (const url of CANDIDATE_URLS) {
    for (const auth of authOptions) {
      for (const p of payloadStyles) {
        try {
          const resp = await tryFetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', [auth.headerName]: auth.headerValue },
            body: JSON.stringify(p.body),
          }, 3000);
          if (resp && resp.ok) {
            detectedConfig = { url, authHeader: auth.key, payloadStyle: p.style };
            console.log('Detected provider config', detectedConfig);
            return detectedConfig;
          }
          // try reading text to see if host replied (even 404)
          if (resp && resp.status && resp.status >= 400 && resp.status < 500) {
            const txt = await resp.text();
            console.log('Detection attempt status', url, auth.headerName, p.style, resp.status, txt.slice ? txt.slice(0, 200) : txt);
          }
        } catch (e: any) {
          // network error; skip to next
          // console.debug('detection attempt failed', url, e?.message || e);
        }
      }
    }
  }
  return null;
}

// Simple in-memory rate limiter (dev/testing). Note: serverless platforms may not preserve memory across invocations.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 60; // max requests per IP per window
const ipCounters = new Map<string, { firstTs: number; count: number }>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const rec = ipCounters.get(ip);
  if (!rec) {
    ipCounters.set(ip, { firstTs: now, count: 1 });
    return { ok: true };
  }
  if (now - rec.firstTs > RATE_LIMIT_WINDOW_MS) {
    ipCounters.set(ip, { firstTs: now, count: 1 });
    return { ok: true };
  }
  if (rec.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((rec.firstTs + RATE_LIMIT_WINDOW_MS - now) / 1000) };
  }
  rec.count += 1;
  return { ok: true };
}

function extractTextFromProviderResponse(json: any): string {
  if (!json) return '';
  // Try common provider shapes (Google GenAI, OpenAI-like, and generic fields)
  // 1) Google-style: { candidates: [{ content: [{ text: '...' }] }] }
  const cand = json.candidates?.[0];
  if (cand) {
    const contentPiece = cand.content?.[0];
    if (contentPiece?.text) return contentPiece.text;
    if (cand.output?.[0]?.content?.[0]?.text) return cand.output[0].content[0].text;
  }
  // 2) { output: [{ content: [{ text: '...' }] }] }
  if (json.output?.[0]?.content?.[0]?.text) return json.output[0].content[0].text;
  // 3) OpenAI-like: { choices: [{ text: '...' }] }
  if (json.choices?.[0]?.text) return json.choices[0].text;
  // 4) Some providers use data[0].text or generated_text
  if (json.data?.[0]?.text) return json.data[0].text;
  if (json.generated_text) return json.generated_text;
  if (typeof json === 'string') return json;
  if (json.result) return String(json.result);
  try {
    return JSON.stringify(json);
  } catch (e) {
    return String(json);
  }
}

export async function POST(req: NextRequest) {
  try {
  const xff = req.headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    const rate = checkRateLimit(ip as string);
    if (!rate.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter || 60) } });
    }

    let body: any = {};
    try {
      body = await req.json();
      console.log('Chat request body:', body);
    } catch (parseErr) {
      console.error('Failed to parse request body as JSON', parseErr);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { sessionId, message } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    }

    // Basic sanitization: limit length
    const trimmed = message.trim().slice(0, 4000);

    // Basic moderation blocklist (very small sample). Expand as needed or use a moderation API.
    const blocklist = ['bomb', 'attack', 'kill', 'suicide', 'terror'];
    const lower = trimmed.toLowerCase();
    for (const bad of blocklist) {
      if (lower.includes(bad)) {
        return NextResponse.json({ error: 'Message contains disallowed content' }, { status: 400 });
      }
    }

    // Fetch a small amount of authoritative content from Supabase to include as context in the prompt
    let contextPieces: string[] = [];
    if (supabase) {
      try {
        const stepsRes = await supabase.from('admission_steps').select('step_order,title,description').order('step_order', { ascending: true }).limit(3);
        if (!stepsRes.error && stepsRes.data) {
          const sText = (stepsRes.data as any[]).map((s) => `${s.step_order}. ${s.title}: ${s.description}`).join('\n');
          if (sText) contextPieces.push(`Top admission steps:\n${sText}`);
        }
        const faqsRes = await supabase.from('faqs').select('question,answer').limit(5);
        if (!faqsRes.error && faqsRes.data) {
          const fText = (faqsRes.data as any[]).map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
          if (fText) contextPieces.push(`Helpful FAQs:\n${fText}`);
        }
      } catch (e) {
        console.error('Supabase fetch failed', e);
      }
    }

    const contextString = contextPieces.join('\n\n').slice(0, 4000); // truncate to avoid huge prompts

    const systemPrompt = `You are an admissions assistant for a college. Provide step-by-step guidance for freshmen applicants. Keep answers concise and include suggested next steps. If a question requests forms or file downloads, point to the Admissions page.${contextString ? '\n\nContext from the college database:\n' + contextString : ''}`;

    let assistantText = '';

    if (!CEREBRAS_API_KEY) {
      // Development canned response
      assistantText = `Canned reply: I can help you with admissions steps. You asked: "${trimmed}". Try: "What documents do I need?" or "How to apply?"`;
    } else {
      // Try to autodetect a working endpoint/auth/payload shape and cache it (dev only).
      const provider = await detectProvider();
      let requestUrl = CEREBRAS_API_URL;
      const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
      let bodyObj: any = { prompt: trimmed, context: systemPrompt, temperature: 0.2, max_tokens: 1024 };

      if (provider) {
        requestUrl = provider.url;
        if (provider.authHeader === 'x-api-key') {
          headers['x-api-key'] = CEREBRAS_API_KEY || '';
        } else {
          headers['Authorization'] = `Bearer ${CEREBRAS_API_KEY}`;
        }
        switch (provider.payloadStyle) {
          case 'prompt':
            bodyObj = { prompt: trimmed, context: systemPrompt, temperature: 0.2, max_tokens: 1024 };
            break;
          case 'input':
            bodyObj = { input: trimmed };
            break;
          case 'messages':
            bodyObj = { messages: [{ role: 'user', content: trimmed }] };
            break;
          case 'openai':
            bodyObj = { model: 'gpt-large', prompt: trimmed, max_tokens: 1024 };
            break;
          default:
            bodyObj = { prompt: trimmed, context: systemPrompt };
        }
      } else {
        // Default: use Authorization Bearer and prompt-style payload
        headers['Authorization'] = `Bearer ${CEREBRAS_API_KEY}`;
      }

      console.log('Calling provider at:', requestUrl, 'using payload style:', provider?.payloadStyle || 'prompt', 'authHeader:', provider?.authHeader || 'authorization');

      let resp;
      try {
        resp = await tryFetchWithTimeout(requestUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyObj),
        }, 8000);
      } catch (networkErr) {
        console.error('Network error when calling provider', networkErr);
        return NextResponse.json({ error: 'Network error contacting provider', detail: String(networkErr), suggestion: 'Check network connectivity and provider URL' }, { status: 502 });
      }

      let respText = '';
      try {
        respText = await resp.text();
      } catch (e) {
        console.error('Failed to read response text from provider', e);
      }

      if (!resp.ok) {
        console.error('Provider returned error', resp.status, respText);
        const suggestion = `Check CEREBRAS_API_URL and CEREBRAS_API_KEY, or update the provider path in config.`;
        return NextResponse.json({ error: `Provider error: ${resp.status}`, body: respText, suggestion }, { status: resp.status });
      }

      let json: any = undefined;
      try {
        json = JSON.parse(respText || '{}');
      } catch (e) {
        json = respText;
      }
      assistantText = extractTextFromProviderResponse(json) || 'No reply from provider';
    }

    // Log chat to Supabase if available
    if (supabase) {
      try {
        await supabase.from('chat_logs').insert({ session_id: sessionId || null, user_message: trimmed, assistant_response: assistantText });
      } catch (e) {
        console.error('Supabase insert failed', e);
      }
    }

    return NextResponse.json({ reply: assistantText });
  } catch (error) {
    console.error('Chat route error', error);
    const isProd = process.env.NODE_ENV === 'production';
    const errMsg = (error as Error).message || 'Unknown error';
    const stack = (error as Error).stack || null;
    // In development return stack to aid debugging; avoid exposing stack in production.
    return NextResponse.json(
      isProd ? { error: errMsg } : { error: errMsg, stack },
      { status: 500 }
    );
  }
}
