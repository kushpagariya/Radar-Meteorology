import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'rm-theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Shared persisted light/dark theme state for both the public site and the dashboard. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b1418' : '#f5f6f3');
    document.body.style.backgroundColor = theme === 'dark' ? '#0a1317' : '#f4f6f2';
  }, [theme]);

  useEffect(
    () => () => {
      document.body.style.backgroundColor = '';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f5f6f3');
    },
    [],
  );

  return [theme, setTheme] as const;
}
