import { useEffect, useState } from 'react';
import type { ViewportBand } from './state';

export type { ViewportBand };

/** Typical iPhone CSS width (iPhone 14/15). */
export const IPHONE_WIDTH = 390;
/** Wider than a phone. Below the desktop cutoff this is still the compact layout. */
export const TABLET_LAYOUT_MIN = Math.round(IPHONE_WIDTH * 1.25);

/** A small matchMedia hook used anywhere behavior, not just CSS, changes. */
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

/**
 * iPhone (including landscape) vs iPad-sized vs a wide window.
 * Phone vs tablet vs a wide window. Month packing can follow this; stream
 * cards default to Grid on every device.
 */
export function useViewportBand(): ViewportBand {
  const beyondPhone = useIsWide(TABLET_LAYOUT_MIN);
  const wide = useIsWide(1024);
  const handset = useIsHandset();
  if (handset || !beyondPhone) return 'phone';
  if (wide) return 'desktop';
  return 'tablet';
}

/** Portrait phones plus large phones in landscape — not iPad. */
export function useIsHandset(): boolean {
  const wide640 = useIsWide(640);
  const wide980 = useIsWide(980);
  const portrait = !wide640;
  const landscapePhone = wide640 && !wide980;
  const [short, setShort] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(max-height: 540px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-height: 540px)');
    const sync = () => setShort(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return portrait || (landscapePhone && short);
}
