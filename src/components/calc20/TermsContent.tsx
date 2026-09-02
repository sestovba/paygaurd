// The actual terms, privacy, and liability text — shared by the sign-in
// gate and the read-only viewer in Settings so the two never drift apart.
//
// This is a strong working draft written for a personal tool tracking a
// federal disability program, not a substitute for review by a lawyer
// before this is relied on by anyone beyond the developer.

import { TERMS_VERSION } from '../../domain/legal';

export function TermsContent() {
  return (
    <div className="terms-content">
      <p className="help-note help-note--tight">Last updated {TERMS_VERSION}</p>

      <h3>What this is</h3>
      <p>
        This app helps you keep track of what you earn, and whether it
        goes over the monthly limits Social Security uses. It was built
        by one person for personal use. Social Security did not make it,
        check it, or approve it, and it is not connected to your case
        record in any way.
      </p>

      <h3>Not official guidance</h3>
      <p>
        Only Social Security can tell you where you really stand.
        Everything here is worked out from rules that change every year,
        and from what you typed in. Either can be wrong or out of date.
        Before you make a decision about work, hours, or pay that could
        affect your benefits, check the numbers with Social Security, or
        with a free benefits counselor.
      </p>

      <h3>Use at your own risk</h3>
      <p>
        This tool is provided as-is, with no warranty of any kind, and
        no guarantee that it is accurate, complete, or current. To the
        fullest extent the law allows, the developer is not liable for
        any loss — including a change to or loss of your benefits — that
        comes from relying on this app. Check anything important with
        Social Security before you act on it.
      </p>

      <h3>Your data</h3>
      <p>
        What you type stays on this device. Nothing is sent anywhere
        unless you sign in and switch on cloud sync yourself. You can
        save a copy, or delete everything, from Settings at any time.
      </p>

      <h3>Optional cloud sync</h3>
      <p>
        Cloud sync is off by default and, for now, only available to a
        small allowlist of accounts the developer maintains directly. If
        you turn it on, a copy of your tracker data is stored in
        Firebase (a Google Cloud service) tied to your signed-in Google
        account, used only to keep your own devices in sync — never
        sold, shared, or used for anything else. Turning sync off
        deletes the cloud copy after prompting you to download a local
        backup first.
      </p>

      <h3>Changes to these terms</h3>
      <p>
        These terms may change as the tool does. A change that matters
        asks you to agree again the next time you sign in — the version
        and date above tell you which copy you last accepted.
      </p>
    </div>
  );
}
