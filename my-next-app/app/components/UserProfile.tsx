"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export default function UserProfile() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // signed URL for display
  const [avatarPath, setAvatarPath] = useState<string | null>(null); // storage path to persist in DB
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data && data.user) {
        setUser(data.user);
        setEmail(data.user.email || '');
        // fetch profile from server
        try {
          const resp = await fetch('/api/profile/get', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: data.user.id }) });
          const json = await resp.json();
          const p = json?.profile || null;
          setProfile(p);
          setName(p?.name || '');
          setContact(p?.contact_number || '');
          // profile.avatar_url stores the storage path; signed_avatar_url is a short-lived display URL
          setAvatarPath(p?.avatar_url || null);
          setAvatarUrl(p?.signed_avatar_url || null);
          setIsAnonymous(!!p?.is_anonymous);
        } catch (e) {
          // ignore
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      setMessage('Uploading...');
      try {
        const res = await fetch('/api/profile/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, fileName: f.name, base64: b64, contentType: f.type }) });
        const j = await res.json();
        if (j?.signedUrl) {
          // j.path is storage path; j.signedUrl is short-lived display url
          setAvatarPath(j.path);
          setAvatarUrl(j.signedUrl);
          setMessage('Upload complete');
        } else {
          setMessage('Upload failed');
        }
      } catch (err) {
        setMessage('Upload failed');
      }
      setTimeout(() => setMessage(null), 2000);
    };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!user) { setMessage('Not signed in'); return; }
    setLoading(true);
    try {
      // persist avatarPath (storage path) rather than signed URL; send both for clarity
      const res = await fetch('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, name, contactNumber: contact, avatarPath: avatarPath || null, avatarUrl: avatarUrl || null, isAnonymous }) });
      const j = await res.json();
      if (j?.profile) {
        setProfile(j.profile);
        setMessage('Profile saved');
      } else {
        setMessage('Save failed');
      }
    } catch (e) {
      setMessage('Save failed');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="rounded bg-white p-6 shadow border text-gray-900">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Profile</h2>
        {!user ? (
          <div className="text-sm text-gray-700">Please sign in to edit your profile.</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gray-100 overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-gray-500">No</div>}
              </div>
              <div>
                <div className="text-sm text-gray-700">Email (read-only)</div>
                <div className="text-sm font-medium text-gray-900">{email}</div>
                <div className="mt-2 text-xs text-gray-600">Upload a profile image (optional)</div>
                <input type="file" accept="image/*" onChange={onFileChange} className="mt-2" />
              </div>
            </div>

            <label className="block">
              <div className="text-sm text-gray-700">Name</div>
              <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            </label>

            <label className="block">
              <div className="text-sm text-gray-700">Contact number</div>
              <input value={contact} onChange={e => setContact(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-gray-900 placeholder-gray-400" />
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
              <div className="text-sm text-gray-700">Enable anonymous mode (hides your name in public suggestions)</div>
            </label>

            <div className="flex items-center gap-2">
              <button onClick={save} disabled={loading} className="rounded bg-[#006600] px-4 py-2 text-white">{loading ? 'Saving...' : 'Save'}</button>
              {message ? <div className="text-sm text-gray-700">{message}</div> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
