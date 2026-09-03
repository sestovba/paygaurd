import { useEffect, useState } from 'react';
import { useIsWide } from '../../viewport';
import type { ViewportBand } from './state';

export type { ViewportBand };
/* The hook itself is no layout's property — it moved to src/viewport.ts when
   PayGuard needed it too. Re-exported here so this layout's own call sites
   keep reading from the file that also owns its band helpers. */
export { useIsWide };

/** Typical iPhone CSS width (iPhone 14/15). */
export const IPHONE_WIDTH = 390;
/** Wider than a phone. Below the desktop cutoff this is still the compact layout. */
export const TABLET_LAYOUT_MIN = Math.round(IPHONE_WIDTH * 1.25);

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
