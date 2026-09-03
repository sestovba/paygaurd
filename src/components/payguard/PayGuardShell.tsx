import type { ReactNode } from 'react';
import { loadUi } from '../../state/storage';
import { useTheme } from '../../theme';

/**
 * Applies the PayGuard palette to a full-screen surface.
 *
 * The sign-in and terms screens render before (or outside) the tracker, so
 * they never picked up a layout's theme and always arrived in index.css's
 * default skin. Wrapping them here means the first screen someone sees
 * matches the app they're about to land in.
 */
export function PayGuardShell({ children }: { children: ReactNode }) {
  // Read straight from storage: this renders before the tracker provider,
  // so there is no context to ask.
  const { palette, theme } = loadUi();
  useTheme(theme, palette);

  // One palette for the app, so there is nothing to choose between here —
  // this used to pick between payguardTheme and workRecordTheme depending on
  // which of the two layouts sharing this skin you were about to land in.

  return (
    <div
      className="pg-payguard flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6"
    >
      {children}
    </div>
  );
}
