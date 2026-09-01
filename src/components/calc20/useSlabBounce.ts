import { useEffect, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';

/** One settle bounce after `trigger` changes — not on first paint. */
export function useSlabBounce(trigger: boolean) {
  const [bounce, setBounce] = useState(false);
  const skip = useRef(true);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    setBounce(true);
  }, [trigger]);

  return {
    bounce,
    onAnimationEnd(event: AnimationEvent<HTMLElement>) {
      if (event.target === event.currentTarget) setBounce(false);
    }
  };
}
