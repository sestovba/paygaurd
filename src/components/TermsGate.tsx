// Shown once per account after sign-in, whenever the signed-in session
// hasn't accepted the current TERMS_VERSION yet. Signed-out / local-only use
// never sees this — there's no identity to attach consent to.

import { useState } from 'react';
import { TermsContent } from './TermsContent';
import { BrandMark } from './ui';
import { PayGuardShell } from './payguard/PayGuardShell';

export function TermsGate({ onAgree }: { onAgree: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <PayGuardShell>
      <div className="panel flex w-full max-w-lg flex-col gap-5 p-6 sm:p-8">
        <BrandMark />
        <div>
          <p className="label-caps text-accent-foreground">PayGuard</p>
          <h1 className="display-figure mt-1 text-3xl">Terms, privacy, and liability</h1>
          <p className="type-muted mt-2">
            Read this before continuing — it explains what this tool can and
            can't do, and what happens to your data.
          </p>
        </div>

        <div className="rounded-lg border border-warn/40 bg-warn-soft/60 p-3 text-xs leading-relaxed text-warn-foreground">
          <strong>Notice:</strong> This is a planning estimate, not legal or benefits advice. The Social Security Administration's determination is the only official record.
        </div>

        <div className="pg-border-all pg-surface-2 max-h-72 overflow-y-auto rounded-[var(--pg-radius-md)] p-4">
          <TermsContent />
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 text-base">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="size-5 shrink-0"
            />
            <span>I've read and agree to these terms.</span>
          </label>
          <button
            type="button"
            disabled={!checked}
            onClick={onAgree}
            className="btn-primary disabled:opacity-40"
          >
            Agree &amp; continue
          </button>
        </div>
      </div>
    </PayGuardShell>
  );
}
