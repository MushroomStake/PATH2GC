"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthModal from "./AuthModal";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function NavBar() {
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Avatar helper component: attempts to render provided src, falls back to initials placeholder on error
  function Avatar({ src, alt, className }: { src?: string | null; alt?: string; className?: string }) {
    const [errored, setErrored] = useState(false);
    const initials = (alt || '')?.trim()?.slice(0, 1).toUpperCase();
    if (!src || errored) {
      return (
        <div className={`h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-500 ${className || ''}`}>
          {initials || '?'}
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt || 'avatar'} className={`h-8 w-8 rounded-full object-cover ${className || ''}`} onError={() => setErrored(true)} />
    );
  }
  // assistant now lives at /assistant

  useEffect(() => {
    let sub: { data?: any } | null = null;
    async function init() {
      if (!supabase) return;
      try {
        const s = await supabase.auth.getSession();
        setUser(s.data?.session?.user ?? null);
        // try to fetch profile via server API to get signed avatar URL
        if (s.data?.session?.user) {
          try {
            const resp = await fetch('/api/profile/get', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: s.data.session.user.id }) });
            const j = await resp.json();
            const p = j?.profile ?? null;
            if (p) setUser((u: any) => ({ ...(u || {}), profile: p }));
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
      sub = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setUser(session?.user ?? null);
      });
    }
    init();
    return () => {
      try { sub?.data?.subscription?.unsubscribe?.(); } catch (e) {}
    };
  }, []);

  const openAuth = (tab: "login" | "signup") => {
    setAuthTab(tab);
    setShowAuth(true);
  };

  return (
    <>
      {/* small Avatar helper to gracefully fallback when signed urls fail */}
      {/* eslint-disable-next-line react/display-name */}
      {/** Note: declared inside component to access local state if needed later */}
      
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#008000]">
              <span className="text-sm font-semibold text-white">PG</span>
            </div>
            <span className="text-lg font-semibold text-[#008000]">Path2GC</span>
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="/" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">Home</Link>
            <Link href="/about" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">About</Link>
            <Link href="/profile" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">Profile</Link>
            <Link href="/assistant" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">AI Assistant</Link>
            <div className="ml-4 flex items-center gap-2">
              {!user ? (
                <>
                  <button onClick={() => openAuth("login")} className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium text-white bg-[#006600] hover:bg-[#004d00]">Log in</button>
                  <button onClick={() => openAuth("signup")} className="inline-flex items-center rounded-md border border-[#006600] px-3 py-1 text-sm font-medium text-[#006600] hover:bg-[#f0fff0]">Sign in</button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar src={user.profile?.signed_avatar_url || user.profile?.avatar_url} alt={(user.profile?.name || user.email) as string} />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-700">{user.profile?.name || user.email}</span>
                      <Link href="/profile" className="text-xs text-gray-500 hover:underline">Edit profile</Link>
                    </div>
                  </div>
                  <button onClick={async () => { if (!supabase) return; await supabase.auth.signOut(); setUser(null); }} className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium text-[#006600] border border-[#006600] hover:bg-[#f0fff0]">Sign out</button>
                </>
              )}
            </div>
          </nav>

          {/* Mobile sign-in link + menu button */}
          <div className="flex items-center gap-2 sm:hidden">
            {!user ? (
              <>
                <button onClick={() => openAuth("login")} className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium text-white bg-[#006600] hover:bg-[#004d00]">Log in</button>
                <button onClick={() => openAuth("signup")} className="inline-flex items-center rounded-md border border-[#006600] px-3 py-1 text-sm font-medium text-[#006600] hover:bg-[#f0fff0]">Sign in</button>
              </>
            ) : (
              <>
                <Avatar src={user.profile?.signed_avatar_url || user.profile?.avatar_url} alt={(user.profile?.name || user.email) as string} />
                <button onClick={async () => { if (!supabase) return; await supabase.auth.signOut(); setUser(null); }} className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium text-[#006600] border border-[#006600] hover:bg-[#f0fff0]">Sign out</button>
              </>
            )}
            <button aria-label="open menu" onClick={() => setMenuOpen(v => !v)} className="inline-flex items-center justify-center rounded-md p-2 text-[#006600]">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-6 py-4">
            <nav className="flex flex-col gap-3">
              <Link href="/" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">Home</Link>
              <Link href="/about" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">About</Link>
              <Link href="/profile" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">Profile</Link>
              <Link href="/assistant" className="text-sm font-medium text-[#006600] hover:text-[#004d00]">AI Assistant</Link>
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              {!user ? (
                <>
                  <button onClick={() => openAuth("login")} className="inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-white bg-[#006600] hover:bg-[#004d00]">Log in</button>
                  <button onClick={() => openAuth("signup")} className="inline-flex w-full items-center justify-center rounded-md border border-[#006600] px-3 py-2 text-sm font-medium text-[#006600] hover:bg-[#f0fff0]">Sign in</button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar src={user.profile?.signed_avatar_url || user.profile?.avatar_url} alt={(user.profile?.name || user.email) as string} />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-700">{user.profile?.name || user.email}</span>
                      <Link href="/profile" className="text-xs text-gray-500 hover:underline">Edit profile</Link>
                    </div>
                  </div>
                  <button onClick={async () => { if (!supabase) return; await supabase.auth.signOut(); setUser(null); setMenuOpen(false); }} className="inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-[#006600] border border-[#006600] hover:bg-[#f0fff0]">Sign out</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      {showAuth && <AuthModal initial={authTab} onClose={() => setShowAuth(false)} />}
    </>
  );
}
