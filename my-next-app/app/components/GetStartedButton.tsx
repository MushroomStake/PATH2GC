"use client";
import React from 'react';

export default function GetStartedButton() {
  function openChat() {
    try {
      const input = document.getElementById('admissions-chat-input') as HTMLInputElement | null;
      if (input) {
        input.focus();
        // optional: add a small visual pulse to the chat
        const chat = document.getElementById('admissions-chat');
        if (chat) {
          chat.animate([
            { boxShadow: '0 8px 24px rgba(0,0,0,0.06)' },
            { boxShadow: '0 16px 40px rgba(0,128,0,0.15)' },
            { boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }
          ], { duration: 600 });
        }
        return;
      }
      // fallback: navigate to admissions page where chat is available
      window.location.href = '/admission';
    } catch (e) {
      window.location.href = '/admission';
    }
  }

  return (
    <button onClick={openChat} className="inline-flex items-center gap-2 rounded-md bg-[#008000] px-5 py-3 text-sm font-medium text-white shadow hover:bg-[#006600]">
      Get Started
    </button>
  );
}
