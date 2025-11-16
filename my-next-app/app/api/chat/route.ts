import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { matchIntent, renderIntentResponse } from '../../../src/lib/intents';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
// When true, the server will return a deterministic local mock reply instead of calling the LLM provider.
const USE_MOCK_LLM = process.env.USE_MOCK_LLM === 'true';
// Provider: Cerebras
// NOTE: Assumption: Cerebras exposes a simple REST endpoint that accepts a POST with an auth Bearer token.
// If your Cerebras provider uses a different shape/path, set `CEREBRAS_API_URL` in your environment to the correct URL.
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_URL = process.env.CEREBRAS_API_URL || 'https://api.cerebras.net/v1/generate';
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

const supabase = SUPABASE_SERVICE_ROLE && SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  : null;

// Detection cache for provider endpoint/payload/auth shape. Kept in-memory for dev.
let detectedConfig: null | {
  url: string;
  authHeader: 'authorization' | 'x-api-key';
  payloadStyle: 'prompt' | 'input' | 'messages' | 'openai' | 'chat';
} = null;

const CANDIDATE_URLS = Array.from(new Set([
  CEREBRAS_API_URL,
  'https://api.cerebras.ai/v1/chat/completions',
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

  const payloadStyles: Array<{ style: 'prompt' | 'input' | 'messages' | 'openai' | 'chat'; body: any }> = [
    { style: 'prompt', body: { prompt: 'ping', context: 'test', max_tokens: 1 } },
    // Chat-style with explicit model + messages (Cerebras chat/completions)
    { style: 'chat', body: { model: CEREBRAS_MODEL, messages: [{ role: 'user', content: 'ping' }], stream: false, max_tokens: 1 } } as any,
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
  // 3b) Chat-style: { choices: [{ message: { content: '...' } }] }
  if (json.choices?.[0]?.message?.content) return json.choices[0].message.content;
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

// If a separate TL;DR string is provided, remove the same leading text
// from the main reply to avoid duplication (e.g., both `tldr` and `reply`
// containing the same one-line summary). Comparison is case-insensitive
// and tolerant to trailing punctuation/newline differences.
function stripTldrFromReply(reply: string, tldr?: string) {
  if (!reply || !tldr) return reply;
  try {
    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[\r\n]/g, ' ').trim();
    const nTldr = normalize(tldr).replace(/[\.\!\?]+$/,'');
    const nReply = normalize(reply);
    if (!nTldr) return reply;
    // If reply starts with the tldr (or the tldr plus a trailing punctuation), remove that portion.
    const rx = new RegExp('^' + nTldr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\.!?]?(\s|$)', 'i');
    if (rx.test(nReply)) {
      // Remove only the first occurrence from the original reply (preserve original formatting after)
      // Build a variant of the tldr to remove from the original reply text
      const origTldr = reply.split(/\n/)[0];
      const escaped = origTldr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const origRx = new RegExp('^' + escaped + '[\\.!?]?(\s|\n)?', 'i');
      return reply.replace(origRx, '').trim();
    }
    return reply;
  } catch (e) {
    return reply;
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
    const { sessionId, message, userId, history, simplify } = body;
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

  // Fetch authoritative content from Supabase and pick the most relevant pieces for the user's question.
  let contextPieces: string[] = [];
  // keep top matches available after fetch so we can return deterministic answers for common intents
  let topSteps: any[] = [];
  let topFaqs: any[] = [];
  let allSteps: any[] = [];
  if (supabase) {
      try {
        // helper: simple tokenizer and relevance scoring by token overlap (fast, no external APIs)
        const tokenize = (txt: string) => (txt || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).filter(w => w.length > 2);
        const scoreText = (query: string, text: string) => {
          const qTokens = new Set(tokenize(query));
          if (qTokens.size === 0) return 0;
          const tTokens = tokenize(text);
          let matches = 0;
          for (const t of tTokens) if (qTokens.has(t)) matches++;
          return matches / Math.max(1, tTokens.length);
        };

        // Fetch admission steps and faqs (small tables assumed)
        const stepsRes = await supabase.from('admission_steps').select('id,step_order,title,description,checklist');
        const faqsRes = await supabase.from('faqs').select('id,question,answer');

        const steps = (!stepsRes.error && stepsRes.data) ? (stepsRes.data as any[]) : [];
        allSteps = steps;
        const faqs = (!faqsRes.error && faqsRes.data) ? (faqsRes.data as any[]) : [];

        // Score and pick top N relevant items
        topSteps = steps
          .map(s => ({ item: s, score: Math.max(scoreText(trimmed, s.title || ''), scoreText(trimmed, s.description || '')) }))
          .sort((a,b) => b.score - a.score)
          .filter(x => x.score > 0)
          .slice(0, 4)
          .map(x => x.item);

        topFaqs = faqs
          .map(f => ({ item: f, score: Math.max(scoreText(trimmed, f.question || ''), scoreText(trimmed, f.answer || '')) }))
          .sort((a,b) => b.score - a.score)
          .filter(x => x.score > 0)
          .slice(0, 6)
          .map(x => x.item);

        if (topSteps.length) {
          const sText = topSteps.map((s: any) => `${s.step_order}. ${s.title}: ${s.description}`).join('\n');
          contextPieces.push(`Top relevant admission steps:\n${sText}`);
        }
        if (topFaqs.length) {
          const fText = topFaqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
          contextPieces.push(`Relevant FAQs:\n${fText}`);
        }

        // As a fallback include a short list of the first few steps/faqs to provide general context
        if (contextPieces.length === 0) {
          const sText = steps.slice(0,3).map((s: any) => `${s.step_order}. ${s.title}: ${s.description}`).join('\n');
          if (sText) contextPieces.push(`Top admission steps:\n${sText}`);
          const fText = faqs.slice(0,5).map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
          if (fText) contextPieces.push(`Helpful FAQs:\n${fText}`);
        }
      } catch (e) {
        console.error('Supabase fetch failed', e);
      }
    }

    // contextString will be built after optionally prepending recent client history

    // If the client provided recent conversation history, build a short summary
    // and include a compact transcript. Place the summary first so the LLM sees
    // recent context before the database context (helps follow-ups like "what's next").
    let recentSummary = '';
    if (Array.isArray(history) && history.length) {
      try {
        const maxTurns = 6; // keep the transcript short
        const recent = history.slice(-maxTurns);
        const histLines = recent.map((h: any) => (h.who === 'user' ? `User: ${String(h.text)}` : `Assistant: ${String(h.text)}`));
        // find last user and assistant messages for a one-line summary
        let lastUser = '';
        let lastAssistant = '';
        for (let i = recent.length - 1; i >= 0; i--) {
          const r = recent[i];
          if (!lastUser && r.who === 'user' && r.text) lastUser = String(r.text);
          if (!lastAssistant && r.who === 'assistant' && r.text) lastAssistant = String(r.text);
          if (lastUser && lastAssistant) break;
        }
        if (lastUser || lastAssistant) {
          recentSummary = `${lastUser ? `User asked: "${lastUser}".` : ''} ${lastAssistant ? `Assistant replied: "${lastAssistant}".` : ''}`.trim();
        }
        // include short transcript as a context piece (after the summary we add below)
        contextPieces.unshift(`Recent conversation:\n${histLines.join('\n')}`);
      } catch (e) {
        // ignore malformed history
      }
    }

    const contextString = contextPieces.join('\n\n').slice(0, 4000); // truncate to avoid huge prompts

    // Infer completed steps from recent history (if available)
    function inferCompletedStepsFromHistory(hist: any[] = []) {
      const nums = new Set<number>();
      try {
        for (const h of hist || []) {
          if (!h || !h.text || String(h.who).toLowerCase() !== 'user') continue;
          const txt = String(h.text).toLowerCase();
          // direct matches: "step 3"
          for (const m of txt.matchAll(/step\s+(\d+)/ig)) {
            const n = Number(m[1]); if (!Number.isNaN(n)) nums.add(n);
          }
          // ranges/lists: "steps 1 and 2" or "steps 1,2"
          const seq = txt.match(/steps?\s+([0-9,\sand]+)/i);
          if (seq && seq[1]) {
            for (const d of String(seq[1]).match(/\d+/g) || []) nums.add(Number(d));
          }
        }
      } catch (e) {
        // ignore
      }
      return Array.from(nums.values()).sort((a,b) => a-b);
    }

    const completedSteps = inferCompletedStepsFromHistory(history);

    // Helper: detect short closing/ack messages where suggesting "next steps" is undesired
    const isClosingMessage = (txt: string) => {
      if (!txt) return false;
      const t = txt.trim().toLowerCase();
      // common closers / acknowledgements
      const closers = ['thanks', 'thank you', 'thx', "that's all", 'we\'re done', 'we are done', 'done', 'ok', 'okay', 'got it', 'no, thanks', 'no thanks', 'stop', 'proceed'];
      if (closers.includes(t)) return true;
      // short polite replies
      if (t.length <= 6 && /^(ok|okay|ty|nm|k)$/.test(t)) return true;
      return false;
    };

    // Try intent matching to see if we can reply deterministically from DB
    const sources: Array<{ type: 'step' | 'faq'; id: any; title: string }> = [];
      // Allow disabling deterministic/template responses via environment variable.
      // Accept several truthy values ('true','1','yes','on') and also support
      // `NEXT_PUBLIC_DISABLE_DETERMINISTIC` if set for visibility in the build.
      const rawDisable = (process.env.DISABLE_DETERMINISTIC || process.env.NEXT_PUBLIC_DISABLE_DETERMINISTIC || '').toString();
      const DISABLE_DETERMINISTIC = ['1', 'true', 'yes', 'on'].includes(rawDisable.trim().toLowerCase());
      // Log the raw and normalized values so runtime behavior can be verified in server logs.
      try { console.log('DISABLE_DETERMINISTIC raw=', rawDisable, 'normalized=', DISABLE_DETERMINISTIC); } catch (e) {}
      const intent = matchIntent(trimmed);
      if (intent && DISABLE_DETERMINISTIC) {
        try { console.log('Intent matched but deterministic responses are disabled by env. Intent:', intent.id); } catch (e) {}
      }
      if (!DISABLE_DETERMINISTIC && intent) {
      // If intent matched, render using the most relevant DB rows (prefer `topSteps`).
      // Passing `allSteps` here produced very long replies; prefer `topSteps` to keep
      // deterministic replies concise and relevant. Fallback to `allSteps` only if
      // `topSteps` is empty.
      const rendered = renderIntentResponse(intent.id, (topSteps && topSteps.length) ? topSteps : allSteps, topFaqs, completedSteps);
      if (rendered && rendered.reply) {
        // Sanitize deterministic reply: remove leading TL;DR paragraph and inline 'Source:' lines
        const sanitizeText = (txt: string) => {
          if (!txt) return txt;
          try {
            // Split into paragraphs, but instead of removing a TL;DR paragraph,
            // strip only the leading "TL;DR" label and keep the content that follows.
            const parts = txt.split(/\n\n+/);
            if (parts.length) {
              parts[0] = parts[0].replace(/^\s*(tl\s*[:;]?dr|tldr)\b[:\-]?\s*/i, '');
            }
            let cleaned = parts.join('\n\n');
            // remove any inline occurrences like '(Source: ...)' or 'Source: ...'
            cleaned = cleaned.replace(/\(?\s*source(s)?\s*[:\-]?\s*[^)\n]+\)?/ig, '');
            // remove any lines that start with 'Source:' as a safety
            cleaned = cleaned.split('\n').filter(l => !/^\s*source(s)?\s*[:\-]/i.test(l)).join('\n');
            // remove empty parentheses and tidy whitespace
            cleaned = cleaned.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ');
            // collapse multiple blank lines
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
            return cleaned;
          } catch (e) {
            return txt;
          }
        };
        const originalRenderedReply = rendered.reply;
        const cleanedRenderedReply = sanitizeText(originalRenderedReply);
        // If sanitization removed everything (empty string), fall back to the original reply
        if (!cleanedRenderedReply || !cleanedRenderedReply.trim()) {
          console.warn('Sanitization removed entire deterministic reply; returning original reply to avoid empty response.');
          rendered.reply = originalRenderedReply;
        } else {
          rendered.reply = cleanedRenderedReply;
          // If the user's message appears to be a closing/ack, remove suggested next steps
          try {
            if (isClosingMessage(trimmed)) {
              // remove a 'Next step' or 'Suggested next steps' section and everything after it
              rendered.reply = rendered.reply.replace(/\n\n?(Suggested next steps:|Next step[s]?:)[\s\S]*$/i, '').trim();
            }
          } catch (e) {
            // ignore
          }
        }
        // Deduplicate sources by type+id to avoid repeated source entries in metadata
        try {
          if (Array.isArray(rendered.sources)) {
            const seenSrc = new Set<string>();
            const uniqSources: typeof rendered.sources = [];
            for (const s of rendered.sources) {
              const key = `${s.type}::${String(s.id)}`;
              if (!seenSrc.has(key)) {
                seenSrc.add(key);
                uniqSources.push(s);
              }
            }
            rendered.sources = uniqSources;
          }
        } catch (e) {
          // ignore dedupe errors
        }

        // Avoid duplicating TL;DR text: if `rendered.tldr` is present and the
        // main `rendered.reply` repeats that one-line TL;DR at the top, strip
        // the leading duplicate so the UI can show the TL;DR separately.
        try {
          if (rendered.tldr) {
            rendered.reply = stripTldrFromReply(rendered.reply || '', rendered.tldr);
          }
        } catch (e) {
          // ignore
        }

        // log with path info
        if (supabase) {
          try {
            await supabase.from('chat_logs').insert({ session_id: sessionId || null, user_id: userId || null, user_message: trimmed, assistant_response: rendered.reply, source_meta: rendered.sources, path: 'deterministic' });
          } catch (e) {
            console.error('Supabase insert failed', e);
          }
        }
        return NextResponse.json({ reply: rendered.reply, tldr: rendered.tldr || null, sources: rendered.sources, path: 'deterministic', nextStep: rendered.nextStep || null });
      }
    }

  // Build system prompt and include a short Recent Conversation summary first (if available),
  // then include the database context so the LLM remains grounded.
  const recentPrefix = recentSummary ? `\n\nRecent Conversation Summary:\n${recentSummary}` : '';
  // Plain-language instruction to make replies easier to understand by default
  const plainInstruction = 'Use clear, simple language. Write short sentences, avoid jargon, and define any acronyms. Start replies with a one-line TL;DR when appropriate.';
  const systemPrompt = `${plainInstruction}\n\nYou are an admissions assistant for this college. ONLY answer questions strictly related to the college, its admissions process, application requirements, deadlines, fees, scholarships, interviews, program information, campus procedures, and Frequently Asked Questions (FAQs). Use the provided Recent Conversation Summary and database context when available and avoid inventing details.

If a user's question is outside admissions/school scope, respond briefly with: "I can only answer questions about this college's admissions and FAQs. For other topics, please contact the admissions office." Do not provide unrelated advice or general information outside the school's admissions and FAQ content. When you use content from the database, cite the source items used (e.g., "Source: Admission Step 2 - Application Documents"). Keep answers concise and include suggested next steps. If a question requests forms or file downloads, point the user to the Admissions page.${recentPrefix}${contextString ? '\n\nContext from the college database:\n' + contextString : ''}`;

    let assistantText = '';

    // If the mock toggle is enabled, return a helpful deterministic reply so the UI can be tested locally.
    if (USE_MOCK_LLM) {
      const q = trimmed.toLowerCase();
      if (q.includes('document') || q.includes('documents') || q.includes('what do i need')) {
        assistantText = `Mock reply: To apply as a freshman you'll typically need: 1) Completed application form; 2) PSA/ID or Birth Certificate; 3) Senior High School Transcript or Report Card; 4) 2x2 ID photos; 5) Any program-specific forms. Check the Admissions page for exact file formats and upload instructions.`;
      } else if (q.includes('how to apply') || q.includes('apply')) {
        assistantText = `Mock reply: Create an account on the Admissions portal, fill out the online application, upload required documents, and pay the application fee. After submission, watch for a confirmation email and follow any steps listed there (exams, interviews).`;
      } else if (q.includes('deadline') || q.includes('when')) {
        assistantText = `Mock reply: Deadlines vary by term. Check the Announcement / Enrollment Bulletin on the Admissions page or contact the admissions office for the latest dates.`;
      } else {
        assistantText = `Mock reply: I can help you with admissions steps. You asked: "${trimmed}". Try: "What documents do I need?" or "How to apply?"`;
      }
    } else if (!CEREBRAS_API_KEY) {
      // Development canned response when no provider key is configured.
      assistantText = `Canned reply: I can help you with admissions steps. You asked: "${trimmed}". Try: "What documents do I need?" or "How to apply?"`;
    } else {
      // Try to autodetect a working endpoint/auth/payload shape and cache it (dev only).
      const provider = await detectProvider();
      let requestUrl = CEREBRAS_API_URL;
      const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
      const preferredTemp = simplify ? 0.0 : 0.2;
      const simplifyHint = simplify ? '\n\nPlease phrase answers in short, plain sentences and short bullet lists. Give a one-line TL;DR at the top.' : '';
      let bodyObj: any = { prompt: trimmed, context: systemPrompt + (simplify ? simplifyHint : ''), temperature: preferredTemp, max_tokens: 1024 };

      if (provider) {
        requestUrl = provider.url;
        if (provider.authHeader === 'x-api-key') {
          headers['x-api-key'] = CEREBRAS_API_KEY || '';
        } else {
          headers['Authorization'] = `Bearer ${CEREBRAS_API_KEY}`;
        }
        // Ensure the system prompt is included for chat-style providers by inserting it as a system message
        switch (provider.payloadStyle) {
          case 'prompt':
            bodyObj = { prompt: trimmed, context: systemPrompt + (simplify ? simplifyHint : ''), temperature: preferredTemp, max_tokens: 1024 };
            break;
          case 'chat':
            // Chat-style providers expect a messages array with a system message first
            bodyObj = {
              model: CEREBRAS_MODEL,
              messages: [
                { role: 'system', content: systemPrompt + (simplify ? simplifyHint : '') },
                { role: 'user', content: trimmed }
              ],
              stream: false,
              temperature: preferredTemp,
              max_tokens: 1024
            };
            break;
          case 'input':
            // Some providers support an input + context field
            bodyObj = { input: trimmed, context: systemPrompt + (simplify ? simplifyHint : '') };
            break;
          case 'messages':
            // Include system message for generic messages-style providers
            bodyObj = { messages: [ { role: 'system', content: systemPrompt + (simplify ? simplifyHint : '') }, { role: 'user', content: trimmed } ] };
            break;
          case 'openai':
            // For OpenAI-like completions, prepend the system prompt to the prompt body
            bodyObj = { model: 'gpt-large', prompt: systemPrompt + (simplify ? simplifyHint : '') + '\n\nUser: ' + trimmed, max_tokens: 1024, temperature: preferredTemp };
            break;
          default:
            bodyObj = { prompt: trimmed, context: systemPrompt + (simplify ? simplifyHint : '') };
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

    // Normalize sources and path for non-deterministic replies (LLM / mock / canned)
    const responsePath = USE_MOCK_LLM ? 'mock' : (CEREBRAS_API_KEY ? 'llm' : 'canned');

    // Build a short TL;DR for non-deterministic replies (from LLM/mock)
    const computeTldr = (txt: string) => {
      if (!txt) return '';
      const firstLine = txt.split('\n').find(Boolean) || '';
      const match = firstLine.match(/(.+?[\.\!\?])(\s|$)/);
      if (match && match[1]) return match[1].trim().slice(0, 200);
      return firstLine.trim().slice(0, 200) || txt.trim().slice(0, 200);
    };

    const nonDeterministicTldr = computeTldr(assistantText);

    // If we didn't already populate sources (used by deterministic responses), build them from fetched DB rows
    try {
      if (sources.length === 0 && (topSteps.length || topFaqs.length)) {
        for (const s of topSteps) {
          if (s && s.id) sources.push({ type: 'step', id: s.id, title: s.title || (`Step ${s.step_order || ''}`) });
        }
        for (const f of topFaqs) {
          if (f && f.id) sources.push({ type: 'faq', id: f.id, title: f.question || '' });
        }
      }
    } catch (e) {
      console.error('Failed to build sources array', e);
    }

    // Server-side post-processing: if the client requested simplification and
    // the LLM reply appears complex, call the provider again to simplify the reply.
    const isComplex = (txt: string) => {
      if (!txt) return false;
      try {
        // Heuristic: average words per sentence > 18 OR total words > 180
        const sentences = txt.split(/[\.\!\?]+/).map(s => s.trim()).filter(Boolean);
        const words = txt.split(/\s+/).filter(Boolean);
        const avgWords = sentences.length ? (words.length / sentences.length) : words.length;
        return avgWords > 18 || words.length > 180;
      } catch (e) {
        return false;
      }
    };

    let finalAssistantText = assistantText;
    let finalTldr = nonDeterministicTldr;

    if (simplify && finalAssistantText && isComplex(finalAssistantText) && CEREBRAS_API_KEY) {
      try {
        const simplifierPrompt = `Rewrite the following assistant reply into clear, simple language suitable for a general audience. Use short sentences, avoid jargon, define acronyms, and include a one-line TL;DR at the top. Keep lists short and use plain words.\n\nOriginal reply:\n${finalAssistantText}`;
        const simplifierProvider = await detectProvider();
        let simplifierUrl = CEREBRAS_API_URL;
        const simplifierHeaders: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
        if (simplifierProvider) {
          simplifierUrl = simplifierProvider.url;
          if (simplifierProvider.authHeader === 'x-api-key') simplifierHeaders['x-api-key'] = CEREBRAS_API_KEY || '';
          else simplifierHeaders['Authorization'] = `Bearer ${CEREBRAS_API_KEY}`;
        } else {
          simplifierHeaders['Authorization'] = `Bearer ${CEREBRAS_API_KEY}`;
        }

        let simplifyBody: any = { prompt: simplifierPrompt, max_tokens: 800, temperature: 0.0 };
        if (simplifierProvider) {
          switch (simplifierProvider.payloadStyle) {
            case 'chat':
              simplifyBody = { model: CEREBRAS_MODEL, messages: [{ role: 'system', content: 'You rewrite text into simple plain language.' }, { role: 'user', content: simplifierPrompt }], stream: false, temperature: 0.0, max_tokens: 800 };
              break;
            case 'prompt':
            default:
              simplifyBody = { prompt: simplifierPrompt, max_tokens: 800, temperature: 0.0 };
              break;
          }
        }

        const simplResp = await tryFetchWithTimeout(simplifierUrl, { method: 'POST', headers: simplifierHeaders, body: JSON.stringify(simplifyBody) }, 8000);
        if (simplResp && simplResp.ok) {
          const txt = await simplResp.text();
          let parsed: any = undefined;
          try { parsed = JSON.parse(txt || '{}'); } catch (e) { parsed = txt; }
          const simplified = extractTextFromProviderResponse(parsed) || '';
          if (simplified) {
            finalAssistantText = simplified;
            finalTldr = computeTldr(finalAssistantText);
          }
        }
      } catch (e) {
        console.error('Simplification attempt failed', e);
      }
    }

    // Sanitize finalAssistantText: remove any leading "TL;DR" label but keep the content,
    // and remove inline 'Source:' lines. If sanitization removes everything, fall back.
    const sanitizeText = (txt: string) => {
      if (!txt) return txt;
      try {
        const parts = txt.split(/\n\n+/);
        if (parts.length) {
          // Remove only the literal TL;DR label at the start of the first paragraph
          parts[0] = parts[0].replace(/^\s*(tl\s*[:;]?dr|tldr)\b[:\-]?\s*/i, '');
        }
        let cleaned = parts.join('\n\n');
        // remove any inline occurrences like '(Source: ...)' or 'Source: ...'
        cleaned = cleaned.replace(/\(?\s*source(s)?\s*[:\-]?\s*[^)\n]+\)?/ig, '');
        // remove any lines starting with 'Source:' as a safety
        cleaned = cleaned.split('\n').filter(l => !/^\s*source(s)?\s*[:\-]/i.test(l)).join('\n');
        // tidy whitespace and remove empty parentheses
        cleaned = cleaned.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
        return cleaned;
      } catch (e) {
        return txt;
      }
    };

    const originalAssistantText = finalAssistantText;
    finalAssistantText = sanitizeText(finalAssistantText);
    if (!finalAssistantText || !finalAssistantText.trim()) {
      console.warn('Sanitization removed entire LLM reply; falling back to original assistant text to avoid empty response.');
      finalAssistantText = originalAssistantText || '';
    }
    // If the user just closed the conversation, remove any "Next step" suggestions
    try {
      if (isClosingMessage(trimmed) && finalAssistantText) {
        finalAssistantText = finalAssistantText.replace(/\n\n?(Suggested next steps:|Next step[s]?:)[\s\S]*$/i, '').trim();
      }
    } catch (e) {
      // ignore
    }

    // If the simplifier / LLM also returned a separate TL;DR, remove duplicated
    // leading TL;DR text from the body so the UI can display the tl;dr field only.
    try {
      if (finalTldr) {
        finalAssistantText = stripTldrFromReply(finalAssistantText || '', finalTldr);
      }
    } catch (e) {
      // ignore
    }

    // Log chat to Supabase if available (include source metadata and path)
    if (supabase) {
      try {
        await supabase.from('chat_logs').insert({ session_id: sessionId || null, user_id: userId || null, user_message: trimmed, assistant_response: finalAssistantText, source_meta: sources, path: responsePath });
      } catch (e) {
        console.error('Supabase insert failed', e);
      }
    }

    // Also include local About page content (if present) so the assistant can cite it.
    try {
      const aboutFile = path.join(process.cwd(), 'src', 'data', 'about-content.json');
      const aboutRaw = await fs.readFile(aboutFile, 'utf8');
      const aboutJson = JSON.parse(aboutRaw);
      if (aboutJson && aboutJson.text) {
        contextPieces.push(`About page content:\n${aboutJson.text}`);
      }
    } catch (e) {
      // ignore if file not present or parse failed
    }

    return NextResponse.json({ reply: finalAssistantText, tldr: finalTldr || null, sources, path: responsePath });
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
