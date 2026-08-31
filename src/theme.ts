import { useEffect } from 'react';
import type { ThemePref } from './state/storage';

export function resolveTheme(pref: ThemePref, prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme: ThemePref): void {
  const prefersDark = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  const dark = resolveTheme(theme, prefersDark) === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#181e2b' : '#f9f9f7');
}

export function useTheme(theme: ThemePref): void {
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(theme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}
