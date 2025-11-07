"use client";
import { useEffect, useRef, useState } from 'react';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

export default function AdmissionsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // restore session id
    const sid = localStorage.getItem('admission_session_id');
    if (sid) sessionIdRef.current = sid;
  }, []);

  async function sendMessage(text: string) {
    const id = `${Date.now()}`;
    const newMsg: Message = { id, role: 'user', text };
    setMessages((m) => [...m, newMsg]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current, message: text }),
      });
      const json = await res.json();
      let reply = json.reply || json.error || 'No response';
      if (!json.reply && json.suggestion) {
        reply = `${reply}\n\nSuggestion: ${json.suggestion}`;
      }
      setMessages((m) => [...m, { id: `r-${Date.now()}`, role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { id: `r-${Date.now()}`, role: 'assistant', text: 'Error contacting server' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  }

  return (
    <div id="admissions-chat" className="fixed bottom-6 right-6 z-50 w-96 rounded-lg border bg-white shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <strong className="text-sm text-[#006600]">Admissions Assistant</strong>
        <small className="text-xs text-gray-500">AI helper</small>
      </div>
      <div className="max-h-64 overflow-y-auto p-3">
        {messages.length === 0 && <div className="text-sm text-gray-500">Ask me about admissions steps, requirements, or deadlines.</div>}
        {messages.map((m) => (
          <div key={m.id} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block max-w-[85%] rounded-md p-2 ${m.role === 'user' ? 'bg-green-100 text-gray-900' : 'bg-gray-100 text-gray-900'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <input id="admissions-chat-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question..." className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <button type="submit" disabled={loading} className="rounded-md bg-[#008000] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Send</button>
      </form>
    </div>
  );
}
