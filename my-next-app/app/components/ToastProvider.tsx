"use client";
import React, { createContext, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'loading';
type Toast = { id: number; message: string; type?: ToastType; mounted?: boolean; leaving?: boolean };

const ToastContext = createContext<{ showToast: (message: string, type?: ToastType, durationMs?: number) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info', durationMs = 3000) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const t: Toast = { id, message, type, mounted: false, leaving: false };
    setToasts((s) => [...s, t]);

    // Trigger entrance animation on next tick
    setTimeout(() => {
      setToasts((s) => s.map(x => x.id === id ? { ...x, mounted: true } : x));
    }, 20);

    // Start fade-out a bit before removal to allow animation
    const leaveAt = Math.max(0, durationMs - 300);
    setTimeout(() => {
      setToasts((s) => s.map(x => x.id === id ? { ...x, leaving: true } : x));
    }, leaveAt);

    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, durationMs);
  };

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Centered bottom container */}
      <div aria-live="polite" className="fixed left-1/2 bottom-8 z-50 w-full max-w-3xl -translate-x-1/2 pointer-events-none px-4">
        <div className="mx-auto flex w-full flex-col items-center gap-3">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={
                `pointer-events-auto w-full max-w-lg rounded-lg px-6 py-4 shadow-lg transform transition-all duration-300 ease-out ` +
                `${t.mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ` +
                `${t.leaving ? 'opacity-0 translate-y-6' : ''}`
              }
              style={{ background: t.type === 'success' ? 'rgba(236,253,245,0.95)' : t.type === 'error' ? 'rgba(254,242,242,0.95)' : 'rgba(255,255,255,0.95)', color: t.type === 'success' ? '#065f46' : t.type === 'error' ? '#7f1d1d' : '#111827' }}
            >
              <div className="flex items-center gap-3">
                {/* Icon: check for success, x for error, spinner for info/loading */}
                <div className="flex h-6 w-6 items-center justify-center">
                  {t.type === 'success' ? (
                    <svg className="h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                    </svg>
                  ) : t.type === 'error' ? (
                    <svg className="h-5 w-5 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.414-9.414a1 1 0 011.414 0L10 9.172l.586-.586a1 1 0 011.414 1.414L11.414 10.586l.586.586a1 1 0 01-1.414 1.414L10 12.414l-.586.586a1 1 0 01-1.414-1.414l.586-.586-.586-.586a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className={`h-5 w-5 ${!t.leaving ? 'animate-spin' : ''} text-gray-600`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                </div>
                <div className="flex-1 text-center text-base font-medium">
                  {t.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastProvider;
