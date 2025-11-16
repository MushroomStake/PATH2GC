"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clientSupabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type Message = { who: 'user' | 'assistant'; text: string; sources?: any[] };

// Render inline-only assistant. `onClose` kept optional for compatibility but unused.
export default function AssistantPanel({ sessionId, inline = true }: { sessionId?: string | null; inline?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ text: string }>>([]);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userIsAnonymous, setUserIsAnonymous] = useState<boolean>(false);
  const [historySessions, setHistorySessions] = useState<Array<{ session_id: string; preview: string; last_at: string }>>([]);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [titlesMap, setTitlesMap] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sessionIdRef = useRef<string | null>(sessionId || null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize session id if not provided
  useEffect(() => {
    if (!sessionIdRef.current) {
      try {
        sessionIdRef.current = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `s-${Date.now()}`;
      } catch (e) {
        sessionIdRef.current = `s-${Date.now()}`;
      }
    }
  }, []);

  async function fetchHistory(userId: string) {
    try {
      const r = await fetch('/api/chat/history/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      const j = await r.json();
      setHistorySessions(j?.sessions || []);
    } catch (e) {
      // ignore
    }
  }

  async function loadSession(sessionIdToLoad: string) {
    try {
      const r = await fetch('/api/chat/history/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sessionIdToLoad }) });
      const j = await r.json();
      const msgs: Message[] = [];
      (j?.messages || []).forEach((row: any) => {
        if (row.user_message) msgs.push({ who: 'user', text: row.user_message });
        if (row.assistant_response) msgs.push({ who: 'assistant', text: row.assistant_response, sources: row.source_meta });
      });
      setMessages(msgs);
      sessionIdRef.current = sessionIdToLoad;
    } catch (e) {
      // ignore
    }
  }

  function getDisplayTitle(s: { session_id: string; preview: string }) {
    return titlesMap[s.session_id] || s.preview || 'Conversation';
  }

  async function handleRename(sessionIdToRename: string) {
    try {
      const current = titlesMap[sessionIdToRename] || '';
      const val = window.prompt('Rename conversation', current) || '';
      if (!val) return;
      const next = { ...titlesMap, [sessionIdToRename]: val };
      setTitlesMap(next);
      try { localStorage.setItem('chat_session_titles', JSON.stringify(next)); } catch (e) { /* ignore */ }
      // update historySessions preview for immediate feedback
      setHistorySessions(h => h.map(x => x.session_id === sessionIdToRename ? { ...x, preview: val } : x));
      setOpenMenuFor(null);
    } catch (e) {
      // ignore
    }
  }

  async function handleDelete(sessionIdToDelete: string) {
    try {
      if (!clientSupabase) return;
      const { data } = await clientSupabase.auth.getUser();
      const userId = data?.user?.id;
      if (!userId) return;
      const r = await fetch('/api/chat/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, sessionId: sessionIdToDelete }) });
      const j = await r.json();
      if (j?.ok) {
        setHistorySessions(h => h.filter(x => x.session_id !== sessionIdToDelete));
        // clear stored title
        const next = { ...titlesMap };
        delete next[sessionIdToDelete];
        setTitlesMap(next);
        try { localStorage.setItem('chat_session_titles', JSON.stringify(next)); } catch (e) { /* ignore */ }
        // if currently loaded, clear messages
        if (sessionIdRef.current === sessionIdToDelete) {
          setMessages([]);
          sessionIdRef.current = null;
        }
      } else {
        console.error('delete failed', j);
      }
    } catch (e) {
      console.error('delete error', e);
    } finally {
      setOpenMenuFor(null);
    }
  }

  function startNewChat() {
    try {
      const newId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `s-${Date.now()}`;
      sessionIdRef.current = newId;
    } catch (e) {
      sessionIdRef.current = `s-${Date.now()}`;
    }
    setMessages([]);
  }

  useEffect(() => {
    const el = document.getElementById('assistant-input') as HTMLInputElement | null;
    el?.focus();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    // fetch quick question suggestions
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/chat/suggestions');
        const j = await r.json();
        if (!mounted) return;
        setSuggestions(j?.suggestions || []);
      } catch (e) {
        // ignore
      }
    })();
    // fetch current user's profile for avatar and anonymous flag
    (async () => {
      try {
        if (!clientSupabase) return;
        const { data } = await clientSupabase.auth.getUser();
        const userId = data?.user?.id;
        if (!userId) return;
        const resp = await fetch('/api/profile/get', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
        const body = await resp.json();
        const p = body?.profile;
        if (p) {
          // profile.signed_avatar_url may exist for private avatars
          setUserAvatarUrl(p.signed_avatar_url || p.avatar_url || null);
          setUserIsAnonymous(!!p.is_anonymous);
          // fetch user's conversation history for the sidebar
          try { if (userId) await fetchHistory(userId); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // ignore
      }
    })();
    // hydrate local titles map from localStorage
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('chat_session_titles') : null;
      if (raw) setTitlesMap(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
    return () => { mounted = false; };
  }, []);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    const newMsg: Message = { who: 'user', text };
    setMessages(m => [...m, newMsg]);
    setInput('');
    setLoading(true);
    try {
      // Try to include the authenticated user's id when available so server can record per-user history
      let userId: string | null = null;
      try {
        if (clientSupabase) {
          const { data } = await clientSupabase.auth.getUser();
          if (data && data.user) userId = data.user.id || null;
        }
      } catch (e) {
        // ignore errors getting user; proceed anonymously
      }

  const sid = sessionIdRef.current || null;
  const resp = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sid, message: text, userId }) });
      const json = await resp.json();
      const reply = json?.reply || (json?.error ? `Error: ${json.error}` : 'No reply');
      const sources = json?.sources || json?.source_meta || undefined;
      setMessages(m => [...m, { who: 'assistant', text: reply, sources }]);
  // refresh the history list so the sidebar reflects recent activity
  if (userId) fetchHistory(userId);
    } catch (e: any) {
      setMessages(m => [...m, { who: 'assistant', text: 'Network error when contacting assistant.' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const content = (
    <div className="flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:block md:w-80 mr-6 rounded p-4 h-[75vh] overflow-auto assistant-sidebar" style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Conversations</h4>
          <button onClick={startNewChat} className="text-xs bg-green-600 px-2 py-1 rounded">New</button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {historySessions.length === 0 ? (
            <div className="text-sm text-gray-500">No recent conversations</div>
          ) : historySessions.map((s) => (
            <div key={s.session_id} className="flex items-center justify-between p-3 rounded hover:bg-gray-100 relative">
              <div onClick={() => loadSession(s.session_id)} className="flex-1 text-left cursor-pointer">
                <div
                  className="text-sm font-medium min-w-0 line-clamp-2"
                  style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {getDisplayTitle(s)}
                </div>
                <div className="text-[12px] text-gray-500">{new Date(s.last_at).toLocaleString()}</div>
              </div>
              <div className="ml-2 relative">
                <button onClick={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === s.session_id ? null : s.session_id); }} className="p-1 rounded hover:bg-gray-100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="5" r="2" fill="#374151"/><circle cx="12" cy="12" r="2" fill="#374151"/><circle cx="12" cy="19" r="2" fill="#374151"/></svg>
                </button>

                {openMenuFor === s.session_id ? (
                  <div className="absolute right-0 mt-2 w-36 rounded shadow z-20" style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleRename(s.session_id); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Rename</button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete conversation?')) handleDelete(s.session_id); }} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50">Delete</button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile slide-over sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-80 rounded-r p-4 h-full overflow-auto assistant-sidebar" style={{ background: 'var(--background)', color: 'var(--foreground)', borderRight: '1px solid var(--card-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Conversations</h4>
              <button onClick={() => setSidebarOpen(false)} className="text-xs bg-transparent px-2 py-1 rounded">Close</button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {historySessions.length === 0 ? (
                <div className="text-sm text-gray-500">No recent conversations</div>
              ) : historySessions.map((s) => (
                <div key={s.session_id} className="flex items-center justify-between p-3 rounded hover:bg-gray-100 relative">
                  <div onClick={() => { loadSession(s.session_id); setSidebarOpen(false); }} className="flex-1 text-left cursor-pointer">
                    <div
                      className="text-sm font-medium min-w-0 line-clamp-2"
                      style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    >
                      {getDisplayTitle(s)}
                    </div>
                    <div className="text-[12px] text-gray-500">{new Date(s.last_at).toLocaleString()}</div>
                  </div>
                  <div className="ml-2 relative">
                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === s.session_id ? null : s.session_id); }} className="p-1 rounded hover:bg-gray-100">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="5" r="2" fill="#374151"/><circle cx="12" cy="12" r="2" fill="#374151"/><circle cx="12" cy="19" r="2" fill="#374151"/></svg>
                    </button>

                    {openMenuFor === s.session_id ? (
                      <div className="absolute right-0 mt-2 w-36 rounded shadow z-20" style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleRename(s.session_id); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Rename</button>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete conversation?')) { handleDelete(s.session_id); setSidebarOpen(false); } }} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50">Delete</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded" style={{ background: 'var(--nav-accent)', color: 'var(--nav-button-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>AI</div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Show conversations button on mobile */}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden inline-flex items-center rounded-md px-2 py-1 text-xs" style={{ border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>Conversations</button>
          </div>
        </div>

  <div ref={containerRef} className="h-[60vh] md:h-[75vh] overflow-auto p-6" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
          {messages.length === 0 && <div className="text-sm text-gray-500">Ask questions about admissions, documents, deadlines, scholarships, or FAQs.</div>}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <MessageBubble key={i} m={m} index={i} userAvatarUrl={userAvatarUrl} userIsAnonymous={userIsAnonymous} />
            ))}
            {loading ? (
              <div className={`rounded p-3 bg-gray-100 self-start`}>
                <TypingIndicator />
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }}>
          <div className="mb-2">
            {suggestions.length ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => { /* send the suggested text immediately */ sendMessage(s.text); }}
                    className="text-xs px-3 py-1 rounded-full bg-gray-50 hover:bg-gray-100"
                    style={{ border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--foreground)' }}
                  >
                    {s.text.length > 50 ? s.text.slice(0, 47) + '...' : s.text}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="assistant-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} placeholder="Ask about admissions..." className="flex-1 rounded px-3 py-2" style={{ border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }} />
            <button onClick={() => sendMessage()} disabled={loading} className="rounded px-3 py-2 disabled:opacity-60 w-full sm:w-auto" style={{ background: 'var(--nav-accent)', color: 'var(--nav-button-text)' }}>{loading ? '...' : 'Send'}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // Always render inline (no modal/overlay)
  return (
      <div className="mx-auto w-full max-w-6xl p-6 z-50">
      <div className="rounded shadow-lg" style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>{content}</div>
    </div>
  );
}

function MessageBubble({ m, index, userAvatarUrl, userIsAnonymous }: { m: Message; index: number; userAvatarUrl?: string | null; userIsAnonymous?: boolean }) {
  const [showSources, setShowSources] = useState(false);

  const assistantIcon = '/chatbot.png';
  const anonymousIcon = '/student.png';
  const userIcon = userAvatarUrl || anonymousIcon;

  const isUser = m.who === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <img src={assistantIcon} alt="assistant" className="h-8 w-8 rounded-full object-cover" />
      ) : null}

  <div className={`rounded p-3 ${isUser ? 'bg-green-50 self-end' : 'bg-gray-100 self-start'} max-w-full sm:max-w-[80%]`}>
        <div className="text-sm whitespace-pre-line text-gray-900">{m.text}</div>

        {m.sources?.length ? (
          <div className="mt-2 text-xs text-gray-500">
            <button
              onClick={() => setShowSources(s => !s)}
              className="text-xs text-blue-600 hover:underline mr-2"
              aria-expanded={showSources}
            >
              {showSources ? 'Hide sources' : 'Show sources'}
            </button>
            {showSources ? (
              <ul className="list-disc ml-5 mt-1">
                {m.sources.map((s: any, idx: number) => (
                  <li key={idx}>{s.type === 'step' ? `Step ${s.id} - ${s.title}` : `${s.title}`}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {isUser ? (
        <img src={userIsAnonymous ? anonymousIcon : (userAvatarUrl || anonymousIcon)} alt="you" className="h-8 w-8 rounded-full object-cover" />
      ) : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-indicator flex items-center gap-2">
      <style>{`
        .typing-indicator .dot {
          width: 8px;
          height: 8px;
          background: #9ca3af; /* gray-400 */
          border-radius: 9999px;
          display: inline-block;
          animation: typing-wave 1s infinite ease-in-out;
        }
        .typing-indicator .dot:nth-child(1) { animation-delay: 0s; }
        .typing-indicator .dot:nth-child(2) { animation-delay: 0.15s; }
        .typing-indicator .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typing-wave {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
      <div className="flex items-center px-2 py-1">
        <span className="dot" />
        <span className="ml-1 dot" />
        <span className="ml-1 dot" />
      </div>
    </div>
  );
}
