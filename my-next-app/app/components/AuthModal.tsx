"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function AuthModal({ onClose, initial = "login" }: { onClose: () => void; initial?: "login" | "signup" }) {
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
        const user: any = (res as any).data?.user || (res as any).user || null;
        const confirmed = user?.confirmed_at || user?.email_confirmed_at || null;
        if (!confirmed) {
          // If Supabase allowed sign-in but email not confirmed, sign out and instruct the user.
          try { await supabase.auth.signOut(); } catch (e) {}
          setMessage('Your email address has not been confirmed. Please check your inbox for the confirmation link before logging in.');
        } else {
          setMessage("Logged in — you are now signed in.");
          setTimeout(() => onClose(), 900);
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
      <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#006600]">{tab === "login" ? "Log in" : "Sign up"}</h3>
          <button onClick={onClose} className="text-gray-700 hover:text-gray-900">✕</button>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => setTab("login")} className={`flex-1 rounded-md px-3 py-1 ${tab === "login" ? 'bg-[#006600] text-white' : 'border border-gray-200 text-gray-800 hover:bg-gray-50'}`}>Log in</button>
          <button onClick={() => setTab("signup")} className={`flex-1 rounded-md px-3 py-1 ${tab === "signup" ? 'bg-[#006600] text-white' : 'border border-gray-200 text-gray-800 hover:bg-gray-50'}`}>Sign up</button>
        </div>

        {message && <div className="mb-3 rounded bg-yellow-50 p-2 text-sm text-yellow-800">{message}</div>}

        {/* Google sign-in removed per request; focusing on email/password + confirmation */}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block text-sm font-medium text-gray-800">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            <label className="block text-sm font-medium text-gray-800">Password</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            <div className="flex items-center justify-between">
              <button disabled={loading} type="submit" className="rounded bg-[#006600] px-4 py-2 text-white disabled:opacity-60">{loading ? '...' : 'Log in'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3">
            <label className="block text-sm font-medium text-gray-800">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            <label className="block text-sm font-medium text-gray-800">Password</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            <label className="block text-sm font-medium text-gray-800">Confirm password</label>
            <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            <div className="flex items-center justify-end">
              <button disabled={loading} type="submit" className="rounded bg-[#006600] px-4 py-2 text-white disabled:opacity-60">{loading ? '...' : 'Create account'}</button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center text-sm text-gray-700">
          By continuing you agree to the college's terms. This demo stores credentials with Supabase auth.
        </div>
      </div>
    </div>
  );
}
