import { useEffect } from 'react';
import type { Palette, ThemePref } from './state/storage';

export function resolveTheme(pref: ThemePref, prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return prefersDark ? 'dark' : 'light';
}

/**
 * The two theme axes, both written to <html> and nowhere else.
 *
 * `data-palette` is the hue (see styles/palette.css); `.dark` is the ink.
 * They live on the same element on purpose — the sign-in, terms and
 * onboarding screens render outside every layout, and when a layout root
 * carried the palette those screens resolved none of it and arrived in a
 * skin belonging to nothing. One attribute on <html> and every screen in the
 * app, layout or not, is inside it.
 */
export function applyPalette(palette: Palette): void {
  document.documentElement.dataset.palette = palette;
}

/**
 * Is the palette currently on <html> dark whatever the app's setting says?
 *
 * `carbon` is. It has no light form — it says so with `color-scheme: dark`
 * in styles/palette.css — and this asks the stylesheet rather than checking
 * for the name, so adding another single-ink palette needs no change here.
 *
 * The two lines of clearing are the whole trick: `.dark` and the inline
 * color-scheme are both things WE set last time, and both would be read back
 * as the palette's own answer.
 */
function paletteIsDark(root: HTMLElement): boolean {
  const hadDark = root.classList.contains('dark');
  const inline = root.style.colorScheme;
  root.classList.remove('dark');
  root.style.colorScheme = '';
  const answer = getComputedStyle(root).colorScheme === 'dark';
  root.classList.toggle('dark', hadDark);
  root.style.colorScheme = inline;
  return answer;
}

export function applyTheme(theme: ThemePref): void {
  const prefersDark = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  const root = document.documentElement;
  /*
   * A single-ink palette forces dark. Without this, `carbon` gave a dark page
   * with every `.dark`-keyed rule switched off — plan kept its light
   * parchment and its light bevels on a black page, and pocket has thirty
   * such rules. One signal fixes all of them; the alternative was writing
   * `[data-palette='carbon']` beside `.dark` in every one.
   */
  const dark = paletteIsDark(root) || resolveTheme(theme, prefersDark) === 'dark';
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  // The browser chrome cannot read a custom property, so this is the one
  // place a palette value has to be copied out into JavaScript.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--t-bg').trim();
    meta.setAttribute('content', bg || (dark ? '#181e2b' : '#f9f9f7'));
  }
}

export function useTheme(theme: ThemePref, palette?: Palette): void {
  useEffect(() => {
    // Palette first: applyTheme asks the stylesheet whether that palette is
    // single-ink, and cannot get a useful answer before it is on the element.
    if (palette) applyPalette(palette);
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(theme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, palette]);
}
