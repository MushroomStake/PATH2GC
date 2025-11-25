"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useToast } from "./ToastProvider";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function AuthModal({ onClose, initial = "login" }: { onClose: () => void; initial?: "login" | "signup" }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"login" | "signup">(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!supabase) throw new Error("Supabase not configured");
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) {
        const msg = res.error.message || String(res.error);
        // Friendly handling for unconfirmed email
        if (/confirm|verification|verified|verified_email|email not confirmed|not confirmed/i.test(msg)) {
          setMessage('Your email address has not been confirmed. Please check your inbox for the confirmation link.');
        } else {
          setMessage(msg);
        }
      } else {
        // Explicitly fetch the current user to get authoritative confirmation fields
        try {
          const getRes = await supabase.auth.getUser();
          const user: any = getRes?.data?.user ?? (res as any).data?.user ?? (res as any).user ?? null;
          const confirmed = user?.confirmed_at || user?.email_confirmed_at || null;
          if (!confirmed) {
            // Prevent access for unverified emails: sign out and notify user
            try { await supabase.auth.signOut(); } catch (e) {}
            setMessage('Your email address has not been confirmed. Please check your inbox for the confirmation link before logging in.');
            showToast('Please confirm your email before signing in', 'error');
          } else {
            setMessage("Logged in — you are now signed in.");
            showToast('Signed in successfully', 'success');
            setTimeout(() => onClose(), 900);
          }
        } catch (e) {
          // If fetching the user fails, be conservative and sign out
          try { await supabase.auth.signOut(); } catch (e) {}
          setMessage('Unable to verify account status. Please try again or contact support.');
        }
      }
    } catch (e: any) {
      setMessage(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (!supabase) throw new Error("Supabase not configured");
      if (password !== confirmPassword) {
        setMessage('Passwords do not match');
        setLoading(false);
        return;
      }
      const res = await supabase.auth.signUp({ email, password });
      if (res.error) {
        setMessage(res.error.message || String(res.error));
      } else {
        setMessage("Sign up successful. Check your email to confirm your account.");
        setTimeout(() => onClose(), 1200);
      }
    } catch (e: any) {
      setMessage(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Magic link flow intentionally removed from UI; keep code minimal.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg p-6 shadow-lg" style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#006600]">{tab === "login" ? "Log in" : "Sign up"}</h3>
          <button onClick={onClose} className="text-gray-700 hover:text-gray-900">✕</button>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => setTab("login")} className="flex-1 rounded-md px-3 py-1" style={tab === 'login' ? { background: 'var(--nav-accent)', color: 'var(--nav-button-text)' } : { border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>Log in</button>
          <button onClick={() => setTab("signup")} className="flex-1 rounded-md px-3 py-1" style={tab === 'signup' ? { background: 'var(--nav-accent)', color: 'var(--nav-button-text)' } : { border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>Sign up</button>
        </div>

        {message && <div className="mb-3 rounded bg-yellow-50 p-2 text-sm text-yellow-800">{message}</div>}

        {/* Google sign-in removed per request; focusing on email/password + confirmation */}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded px-3 py-2" style={{ border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }} />
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Password</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded px-3 py-2" style={{ border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }} />
            <div className="flex items-center justify-between">
              <button disabled={loading} type="submit" className="rounded px-4 py-2" style={{ background: 'var(--nav-accent)', color: 'var(--nav-button-text)' }}>{loading ? '...' : 'Log in'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded px-3 py-2" style={{ border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }} />
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Password</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded px-3 py-2" style={{ border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }} />
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Confirm password</label>
            <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded px-3 py-2" style={{ border: '1px solid var(--card-border)', background: 'var(--background)', color: 'var(--foreground)' }} />
            <div className="flex items-center justify-end">
              <button disabled={loading} type="submit" className="rounded px-4 py-2" style={{ background: 'var(--nav-accent)', color: 'var(--nav-button-text)' }}>{loading ? '...' : 'Create account'}</button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center text-sm text-gray-700">
          By continuing you agree to the college's terms.
        </div>
      </div>
    </div>
  );
}
