// Appearance for the Calc20 layout.
//
// Ported from sga_calc20/src/theme.ts, with two additions the port needs:
//
//   1. `.pg-calc20` on <html>. Every rule in styles/calc20.css is scoped
//      under that class, so the whole stylesheet is inert until this layout
//      is on screen, and goes inert again the moment it is switched away
//      from. It sits on <html> rather than on the layout's own root because
//      popovers and sheets portal to document.body — they must stay inside
//      the scope.
//   2. PayGuard's `.dark` class is kept in step with this layout's
//      `data-theme` attribute. Two conventions for one preference: shared
//      components and Tailwind utilities read the class, the ported
//      stylesheet reads the attribute.

import { useEffect } from 'react';
import type { ThemePref } from '../../state/storage';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_COLOR_LIGHT = '#eff4f8';
export const THEME_COLOR_DARK = '#09121f';

/** Marks <html> while this layout owns the screen. */
export const CALC20_ROOT_CLASS = 'pg-calc20';

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
  return pref === 'light' || pref === 'dark' ? pref : prefersDark ? 'dark' : 'light';
}

export function applyAppearance(
  ui: { theme: ThemePref; glassStrength: number },
  prefersDark = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
): void {
  const dark = resolveTheme(ui.theme, prefersDark) === 'dark';
  const root = document.documentElement;
  root.classList.add(CALC20_ROOT_CLASS);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const glass = Number.isFinite(ui.glassStrength) ? ui.glassStrength : 0;
  root.style.setProperty('--glass-strength', String(1 - Math.max(0, Math.min(100, glass)) / 100));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

/** Hands the page back to whichever layout comes next. */
export function clearAppearance(): void {
  const root = document.documentElement;
  root.classList.remove(CALC20_ROOT_CLASS);
  delete root.dataset.theme;
  root.style.removeProperty('--glass-strength');
}

/** Keep <html> in sync with Settings, including OS changes while on System. */
export function useAppearance(ui: { theme: ThemePref; glassStrength: number }): void {
  useEffect(() => {
    const sync = () => applyAppearance(ui);
    sync();
    if (ui.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [ui.theme, ui.glassStrength]);

  // Switching layouts unmounts this tree; the stylesheet must stop applying
  // at the same moment, or its :root tokens would repaint the next layout.
  useEffect(() => clearAppearance, []);
}
