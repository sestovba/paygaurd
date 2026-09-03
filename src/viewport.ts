import { useEffect, useState } from 'react';

/**
 * Width, as a fact the components can branch on — not just a class the
 * stylesheet reacts to.
 *
 * Most responsive work belongs in CSS, and stays there. This is for the case
 * where the difference is not how a thing looks but whether it is built at
 * all: a phone that shows one section of three does not need the other two in
 * the document, and `hidden sm:flex` still builds them. On the hardware this
 * app is aimed at — an old Android WebView with a slow processor — nodes that
 * are mounted and never seen are paid for twice, once on first render and
 * again on every re-render that walks past them.
 *
 * The breakpoint is passed in rather than fixed so a call site can name the
 * same number its stylesheet uses. `640` is Tailwind's `sm`, which is where
 * most of this app's phone/desktop splits live.
 *
 * It lives at the root beside `theme.ts` because it belongs to no layout;
 * `calc20/useIsWide.ts` re-exports it and adds the band helpers that only
 * that layout uses.
 *
 * Verifying a caller: mount the page at each width, do not resize a running
 * one. Chrome's device emulation — which is how this app gets looked at —
 * re-lays the page out at the new width without firing either `change` or
 * `resize`, so a component that reads this hook will sit there holding the
 * old answer and look broken when it is not. Reload after resizing.
 */
export function useIsWide(minWidth = 780): boolean {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(`(min-width: ${minWidth}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [minWidth]);

  return wide;
}

/** Tailwind's `sm`. The width at which this app stops being a phone. */
export const WIDE_MIN = 640;
