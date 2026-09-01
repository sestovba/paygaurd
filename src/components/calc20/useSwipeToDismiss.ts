import { useRef } from 'react';

const DISTANCE_PX = 90;
const VELOCITY_PX_PER_MS = 0.5;

/**
 * Drag-down-to-dismiss for a bottom-docked surface, on whichever handle
 * element these handlers get attached to (a grip or title bar — not the
 * scrollable body, which needs its own vertical drag for scrolling).
 * Writes the live drag offset straight to the node's own style, not React
 * state, so it can track a touchmove stream at full rate.
 */
export function useSwipeToDismiss(surfaceRef: React.RefObject<HTMLElement | null>, onDismiss: () => void) {
  const startY = useRef(0);
  const startTime = useRef(0);
  const dragging = useRef(false);

  const onTouchStart = (event: React.TouchEvent) => {
    startY.current = event.touches[0].clientY;
    startTime.current = Date.now();
    dragging.current = true;
    const node = surfaceRef.current;
    if (node) node.style.transition = 'none';
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (!dragging.current) return;
    const delta = event.touches[0].clientY - startY.current;
    if (delta <= 0) return;
    const node = surfaceRef.current;
    if (node) node.style.transform = `translateY(${delta}px)`;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = event.changedTouches[0].clientY - startY.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = delta / Math.max(1, elapsed);
    const node = surfaceRef.current;
    if (node) node.style.transition = '';
    if (delta > DISTANCE_PX || (delta > 0 && velocity > VELOCITY_PX_PER_MS)) {
      onDismiss();
      return;
    }
    if (node) node.style.transform = '';
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}
