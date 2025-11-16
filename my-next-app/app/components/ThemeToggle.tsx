"use client";
import { useEffect, useState } from "react";
import styles from "./theme-toggle.module.css";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    // determine initial theme: localStorage -> html.class -> prefers-color-scheme
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (stored === "light" || stored === "dark") {
      applyTheme(stored);
      setTheme(stored);
      return;
    }

    // prefer existing html.class if present
    if (document.documentElement.classList.contains('dark')) {
      setTheme('dark');
      return;
    }
    if (document.documentElement.classList.contains('light')) {
      setTheme('light');
      return;
    }

    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = prefersDark ? "dark" : "light";
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function applyTheme(t: "light" | "dark") {
    try { localStorage.setItem("theme", t); } catch (e) {}
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next as "light" | "dark");
    setTheme(next as "light" | "dark");
    // trigger a short animation on toggle
    setAnimating(true);
    window.setTimeout(() => setAnimating(false), 520);
  }

  return (
    <span className={styles.wrapper}>
      <button
        aria-pressed={theme === "dark"}
        onClick={toggle}
        title="Toggle dark / light theme"
        className={`${styles.button} ${theme === 'dark' ? styles.pressed : ''} ${animating ? styles.anim : ''}`}
      >
        <span className={styles.icon} aria-hidden>
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4V2M12 22v-2M4.93 4.93L3.51 3.51M20.49 20.49l-1.42-1.42M4 12H2M22 12h-2M4.93 19.07l-1.42 1.42M20.49 3.51l-1.42 1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <span className={styles.label}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      <span role="tooltip" className={styles.tooltip}>Toggle theme</span>
    </span>
  );
}
