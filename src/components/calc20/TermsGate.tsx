// Shown once per account after sign-in, whenever the signed-in session
// hasn't accepted the current TERMS_VERSION yet. Signed-out / local-only use
// never sees this — there's no identity to attach consent to.

import { useState } from 'react';
import { TermsContent } from './TermsContent';

export function TermsGate({ onAgree }: { onAgree: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="signin-shell">
      <div className="signin-panel terms-panel">
        <div>
          <div className="eyebrow">SSDI Tracker</div>
          <h1 className="signin-title">Terms, privacy, and liability</h1>
          <p className="signin-note">
            Read this before continuing — it explains what this tool can and
            can't do, and what happens to your data.
          </p>
        </div>

        <div className="terms-scroll">
          <TermsContent />
        </div>

        <div className="signin-actions">
          <label className="terms-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>I've read and agree to these terms.</span>
          </label>
          <button
            className="signin-submit"
            type="button"
            disabled={!checked}
            onClick={onAgree}
          >
            Agree & continue
          </button>
        </div>
      </div>
    </div>
  );
}
