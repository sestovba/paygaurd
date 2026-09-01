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
        This tool helps you track earnings against Social Security's Trial
        Work Period (TWP) and Substantial Gainful Activity (SGA) rules. It is
        an independent, informal calculator built for personal use. It is not
        produced, reviewed, or endorsed by the Social Security Administration
        (SSA) and has no connection to your official case record.
      </p>

      <h3>Not official guidance</h3>
      <p>
        Only SSA can tell you your actual TWP and SGA status. The figures,
        limits, and warnings shown here are estimates based on rules that
        change yearly and on the data you enter — both can be wrong or out of
        date. Before making a decision about work, hours, or income that
        could affect your benefits, verify the numbers with SSA directly or
        with a benefits counselor (for example, a Work Incentives Planning
        and Assistance program).
      </p>

      <h3>Use at your own risk</h3>
      <p>
        This tool is provided as-is, with no warranty of any kind, and no
        guarantee that it is accurate, complete, or current. To the fullest
        extent the law allows, the developer is not liable for any loss —
        including a change to or loss of benefits — arising from reliance on
        this tool. You are responsible for confirming anything important with
        SSA before acting on it.
      </p>

      <h3>Your data</h3>
      <p>
        The income figures, dates, and hours you enter are stored only on
        this device by default, in your browser's local storage. Nothing you
        enter is sent anywhere unless you sign in and turn on optional cloud
        sync yourself. You can export a backup or clear your data at any time
        from Settings.
      </p>

      <h3>Optional cloud sync</h3>
      <p>
        Cloud sync is off by default and, for now, only available to a small
        allowlist of accounts the developer maintains directly. If you turn
        it on, a copy of your tracker data is stored in Firebase (a Google
        Cloud service) tied to your signed-in Google account, used only to
        keep your own devices in sync — never sold, shared, or used for
        anything else. Turning sync off deletes the cloud copy after
        prompting you to download a local backup first.
      </p>

      <h3>Changes to these terms</h3>
      <p>
        These terms may change as the tool does. A change that matters asks
        you to agree again the next time you sign in — the version and date
        above tell you which copy you last accepted.
      </p>
    </div>
  );
}
