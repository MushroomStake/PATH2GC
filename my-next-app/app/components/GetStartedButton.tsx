"use client";
import React from 'react';

export default function GetStartedButton() {
  function openChat() {
    try {
      // Try to focus the assistant input if present on the page
      const input = document.getElementById('assistant-input') as HTMLInputElement | null;
      if (input) {
        input.focus();
        // optional: add a small visual pulse to the chat
        const chat = document.getElementById('admissions-chat') || document.getElementById('assistant-panel');
        if (chat) {
          chat.animate([
            { boxShadow: '0 8px 24px rgba(0,0,0,0.06)' },
            { boxShadow: '0 16px 40px rgba(0,128,0,0.15)' },
            { boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }
          ], { duration: 600 });
        }
        return;
      }
      // fallback: navigate to the assistant page
      window.location.href = '/assistant';
    } catch (e) {
      window.location.href = '/assistant';
    }
  }

  return (
    <button onClick={openChat} className="inline-flex items-center gap-2 rounded-md bg-[#008000] px-5 py-3 text-sm font-medium text-white shadow hover:bg-[#006600]">
      Get Started
    </button>
  );
}
