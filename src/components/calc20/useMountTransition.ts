import { useEffect, useState } from 'react';

/**
 * Keeps a popup mounted for `duration` ms after `open` goes false, so its
 * CSS exit animation (a `--closing` modifier class) has time to play before
 * the conditional render actually drops it — the alternative, unmounting on
 * the same tick `open` flips, gives every popup a hard cut instead of a
 * bubble-away.
 */
export function useMountTransition(open: boolean, duration: number): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timer = setTimeout(() => { setMounted(false); setClosing(false); }, duration);
    return () => clearTimeout(timer);
  }, [open, duration, mounted]);

  return { mounted, closing };
}
