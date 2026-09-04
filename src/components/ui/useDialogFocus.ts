import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

export function useDialogFocus<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  onClose: () => void,
  options: { focusContainer?: boolean } = {}
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const focusContainer = options.focusContainer ?? false;

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const first = container.querySelector<HTMLElement>(FOCUSABLE);

      if (focusContainer) {
        container.focus();
      } else {
        (first ?? container).focus();
      }
    });

    const onKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const active = document.activeElement;

      // If another/nested dialog owns focus, this dialog stays inert.
      if (active !== container && !container.contains(active)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE)
      );

      if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, focusContainer]);
}
