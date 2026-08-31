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
  const { layout, payguardTheme, workRecordTheme, theme } = loadUi();
  useTheme(theme);

  // Two layouts share this skin and keep separate palettes; open on whichever
  // one the reader is about to land in.
  const palette = layout === 'workrecord'
    ? workRecordTheme ?? 'calc20'
    : payguardTheme ?? 'paper';

  return (
    <div
      className="pg-payguard flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6"
      data-payguard-theme={palette}
    >
      {children}
    </div>
  );
}
