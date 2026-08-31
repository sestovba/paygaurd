import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/** A tinted callout for help text that matters enough to earn an icon —
 *  not every muted paragraph, just the ones explaining why a field drives
 *  something else in the app. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-accent/60 p-3.5 text-base text-accent-foreground">
      <Info className="mt-0.5 size-5 shrink-0" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
