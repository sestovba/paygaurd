import { useRef, useState } from 'react';
import {
  ArrowRight, Cloud, CloudOff, Crosshair, Download, FileText, HelpCircle, LayoutTemplate,
  LogOut, ShieldCheck, Trash2, Upload
} from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { SYNC_OFF_CONFIRM_WORD, useCloudSyncGuard } from '../state/cloudSyncGuard';
import { displayNameFor, initialsFor } from '../auth/session';
import type { LayoutMode, LedgerTheme } from '../state/storage';
import { InfoNote } from './InfoNote';
import { Sheet } from './Sheet';
import { Segmented, SwatchPicker, Switch } from './ui';
import { TermsContent } from './TermsContent';
import { HelpSpread } from './HelpSpread';
import { LAYOUTS, LayoutSwitcher } from './LayoutSwitcher';
import { SETTINGS_ROW, sectionsFor, type SettingsRowId } from './settingsModel';

/** Three representative colours per sub-theme: surface, accent, secondary. */
const SUB_THEMES: { id: LedgerTheme; label: string; colors: [string, string, string] }[] = [
  { id: 'paper', label: 'Evergreen', colors: ['#ffffff', '#059669', '#ea580c'] },
  { id: 'slate', label: 'Coastal', colors: ['#e8eef5', '#2563eb', '#ea580c'] },
  { id: 'ledger', label: 'Warm Ledger', colors: ['#faf7ed', '#14532d', '#c2410c'] },
  { id: 'carbon', label: 'Midnight', colors: ['#111827', '#10b981', '#f97316'] },
  // Ported from the sibling sga_calc20 project's "2026 Work Record" design.
  { id: 'calc20', label: 'Studio Blue', colors: ['#eef1f6', '#2f2a44', '#7cc0e8'] }
];

/** A settings row that opens something else. */
function LinkRow({ icon, label, onClick }: { icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5 text-left text-base font-semibold hover:bg-muted"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="field-label">{title}</span>
      {children}
    </div>
  );
}

/** The panel that opens under the sync switch. Two of them, one shape. */
function GuardPanel({ tone = 'plain', title, children }: {
  tone?: 'plain' | 'danger';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={'flex flex-col gap-2 rounded-lg border p-4 ' + (tone === 'danger'
        ? 'border-destructive/30 bg-destructive/10'
        : 'border-border bg-surface-2')}
    >
      <span className={'text-base font-semibold' + (tone === 'danger' ? ' text-destructive' : '')}>
        {title}
      </span>
      {children}
    </div>
  );
}

export function SettingsPanel({
  theme, onTheme, onOpenStatus, onReset, onClose, variant = 'sheet', backLabel,
  layout, onLayoutChange
}: {
  theme: 'system' | 'light' | 'dark';
  onTheme: (theme: 'system' | 'light' | 'dark') => void;
  onOpenStatus: () => void;
  onReset: () => void;
  onClose: () => void;
  variant?: 'sheet' | 'inline';
  backLabel?: string;
  layout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
  /*
   * The palette used to arrive as a prop pair, passed only by the three
   * layouts that had one — so seven layouts offered no way to change the
   * colour of an app that has five. There is one `ui.palette` now and every
   * layout answers it, so this reads it from the tracker like every other
   * preference on this screen and the row is always drawn.
   */
}) {
  const {
    data, ui, setUi, replaceAll,
    session, signOut, canSync, cloudSyncEnabled, cloudSyncStatus, setCloudSyncEnabled
  } = useTracker();
  const [helpSpreadOpen, setHelpSpreadOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  /* The layout list is seven options with a line of prose each — a screenful
     inside a sheet you opened to do something else. It is a choice you make
     once, so it gets a row that names the current one and a page of its
     own. */
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutName = LAYOUTS.find((option) => option.id === layout)?.label ?? 'Choose';
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paycheck-guard-${ui.year}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.streams)) {
          alert('That file is not one of your saved copies.');
          return;
        }
        if (confirm('Load this copy? It replaces every job and every month on this device.')) {
          replaceAll(parsed);
        }
      } catch {
        alert('We could not read that file.');
      }
    };
    reader.readAsText(file);
  }

  /* Turning sync off deletes the account's Firebase copy outright, so the
     switch opens a step instead of doing it. Shared with calc20, which is
     where the careful version of this was written. */
  const syncGuard = useCloudSyncGuard({
    enabled: cloudSyncEnabled,
    setEnabled: setCloudSyncEnabled,
    backup: exportJson
  });

  const syncStatusLabel = cloudSyncStatus === 'syncing' ? 'Syncing…'
    : cloudSyncStatus === 'synced' ? 'Synced'
      : cloudSyncStatus === 'error' ? 'Sync error — retrying' : 'Off';

  /* What this screen can draw. Order and wording come from settingsModel;
     a section left with nothing in it does not appear. */
  const rows: SettingsRowId[] = [
    'account',
    ...(session && canSync ? ['sync' as const] : []),
    ...(session ? ['terms' as const] : []),
    'focusMode',
    'layout',
    ...(ui.layout === 'overview' ? ['overviewShell' as const] : []),
    'theme',
    'palette',
    'export',
    'import',
    'clearAll',
    'benefitStatus',
    'howIncomeWorks'
  ];

  function renderRow(id: SettingsRowId) {
    switch (id) {
      case 'account':
        return !session ? (
          <InfoNote key={id}>
            Signed out — running with auth bypassed (local development). Everything stays on this device.
          </InfoNote>
        ) : (
          <div key={id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-bold text-accent-foreground">
              {session.photoURL ? <img src={session.photoURL} alt="" className="size-full object-cover" /> : initialsFor(session)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">{displayNameFor(session)}</span>
              {session.email ? <span className="type-muted block truncate text-sm">{session.email}</span> : null}
            </span>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="icon-btn grid shrink-0 text-muted-foreground hover:bg-muted"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        );

      case 'sync':
        return (
          <div key={id} className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-base font-semibold">
                  {cloudSyncEnabled ? <Cloud className="size-4" /> : <CloudOff className="size-4" />}
                  {SETTINGS_ROW.sync.label}
                </span>
                <span className="type-muted text-[0.9375rem]">{syncStatusLabel}</span>
              </span>
              <Switch
                checked={cloudSyncEnabled}
                label="Toggle cloud sync"
                onChange={syncGuard.press}
              />
            </label>

            {syncGuard.step === 'consent' ? (
              <GuardPanel title="Before you turn this on">
                <p className="type-muted text-sm">
                  Your jobs, months and paychecks will be kept in Firebase under this
                  account instead of only on this device. That is what lets a second
                  device see them after you sign in. Turning it off again deletes the
                  Firebase copy — it does not pause it.
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={syncGuard.turnOn}
                    className="rounded-lg bg-accent px-4 py-2.5 text-base font-semibold text-accent-foreground"
                  >
                    I agree — turn on
                  </button>
                  <button
                    type="button"
                    onClick={syncGuard.cancel}
                    className="rounded-lg px-4 py-2.5 text-base font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </GuardPanel>
            ) : null}

            {syncGuard.step === 'confirm-off' ? (
              <GuardPanel tone="danger" title="This deletes the Firebase copy">
                <p className="text-sm">
                  Turning sync off <strong>deletes</strong> your data from Firebase. It is
                  not a pause and it cannot be undone. A copy downloads to this device
                  the moment you confirm. Type {SYNC_OFF_CONFIRM_WORD} to continue.
                </p>
                <input
                  type="text"
                  value={syncGuard.confirmText}
                  onChange={(e) => syncGuard.setConfirmText(e.target.value)}
                  placeholder={SYNC_OFF_CONFIRM_WORD}
                  aria-label={`Type ${SYNC_OFF_CONFIRM_WORD} to confirm`}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base"
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!syncGuard.canConfirmOff}
                    onClick={syncGuard.turnOffWithBackup}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-base font-semibold text-destructive disabled:opacity-40"
                  >
                    Download backup &amp; delete
                  </button>
                  <button
                    type="button"
                    onClick={syncGuard.cancel}
                    className="rounded-lg px-4 py-2.5 text-base font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </GuardPanel>
            ) : null}
          </div>
        );

      case 'terms':
        return (
          <LinkRow
            key={id}
            icon={<FileText className="size-5 text-muted-foreground" />}
            label={SETTINGS_ROW.terms.label}
            onClick={() => setTermsOpen(true)}
          />
        );

      case 'focusMode':
        return (
          <label key={id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5">
            <span className="flex min-w-0 gap-2">
              <Crosshair className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-base font-semibold">{SETTINGS_ROW.focusMode.label}</span>
                <span className="type-muted mt-0.5 block text-sm leading-snug">
                  {SETTINGS_ROW.focusMode.help}
                </span>
              </span>
            </span>
            {/* Clearing monthScope hands the month lists back to this
                switch. Otherwise a dropdown set on one layout would quietly
                outrank the switch here and it would look broken. */}
            <Switch
              checked={ui.focusMode}
              label={SETTINGS_ROW.focusMode.label}
              onChange={() => setUi({ focusMode: !ui.focusMode, monthScope: undefined })}
            />
          </label>
        );

      case 'layout':
        return (
          <LinkRow
            key={id}
            icon={<LayoutTemplate className="size-5 text-muted-foreground" />}
            label={`${SETTINGS_ROW.layout.label} · ${layoutName}`}
            onClick={() => setLayoutOpen(true)}
          />
        );

      case 'theme':
        return (
          <Segmented
            key={id}
            value={theme}
            columns={3}
            onChange={onTheme}
            options={[
              { id: 'system', label: 'System' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' }
            ]}
          />
        );

      case 'overviewShell':
        /* Labelled, unlike Theme above it, because "One page / Separate
           pages / Side by side" says nothing on its own sitting under a
           heading called Appearance. */
        return (
          <div key={id} className="flex flex-col gap-2">
            <div>
              <span className="block text-base font-semibold">{SETTINGS_ROW.overviewShell.label}</span>
              <span className="type-muted mt-0.5 block">{SETTINGS_ROW.overviewShell.help}</span>
            </div>
            <Segmented
              value={ui.overviewShell}
              onChange={(overviewShell) => setUi({ overviewShell })}
              columns={3}
              options={[
                { id: 'scroll' as const, label: 'One page' },
                { id: 'pages' as const, label: 'Separate pages' },
                { id: 'workspace' as const, label: 'Side by side' }
              ]}
            />
          </div>
        );

      case 'palette':
        return (
          <SwatchPicker
            key={id}
            label={SETTINGS_ROW.palette.label}
            value={ui.palette}
            onChange={(palette) => setUi({ palette })}
            options={SUB_THEMES}
          />
        );

      /* Export and import are one row of two buttons, so the pair is drawn
         on 'export' and 'import' draws nothing. */
      case 'export':
        return (
          <div key={id} className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={exportJson}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-3 text-base font-semibold hover:bg-muted"
            >
              <Download className="size-4 text-muted-foreground" /> {SETTINGS_ROW.export.label}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-3 text-base font-semibold hover:bg-muted"
            >
              <Upload className="size-4 text-muted-foreground" /> {SETTINGS_ROW.import.label}
            </button>
          </div>
        );
      case 'import':
        return null;

      case 'clearAll':
        return (
          <div key={id} className="flex flex-col">
            <button
              type="button"
              onClick={onReset}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-base font-semibold text-destructive hover:bg-destructive/15"
            >
              <Trash2 className="size-5" /> {SETTINGS_ROW.clearAll.label}
            </button>
            <p className="type-muted mt-1 px-1 text-sm">
              Earnings stay on this device unless you turn on sync.
            </p>
          </div>
        );

      case 'benefitStatus':
        return (
          <LinkRow
            key={id}
            icon={<ShieldCheck className="size-5 text-muted-foreground" />}
            label={SETTINGS_ROW.benefitStatus.label}
            onClick={onOpenStatus}
          />
        );

      case 'howIncomeWorks':
        return (
          <LinkRow
            key={id}
            icon={<HelpCircle className="size-5 text-muted-foreground" />}
            label={SETTINGS_ROW.howIncomeWorks.label}
            onClick={() => setHelpSpreadOpen(true)}
          />
        );

      default:
        return null;
    }
  }

  return (
    <Sheet
      title="Settings"
      onClose={onClose}
      variant={variant === 'inline' ? 'inline' : 'modal'}
      backLabel={variant === 'inline' ? backLabel : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importJson(file);
          e.target.value = '';
        }}
      />

      {sectionsFor(rows).map((section) => (
        <Section key={section.id} title={section.title}>
          {section.rows.map(renderRow)}
        </Section>
      ))}

      {layoutOpen ? (
        <Sheet title="Layout" eyebrow="Appearance" onClose={() => setLayoutOpen(false)}>
          <LayoutSwitcher value={layout} onChange={onLayoutChange} />
        </Sheet>
      ) : null}

      {termsOpen ? (
        <Sheet title="Terms, privacy, and liability" eyebrow="Legal" onClose={() => setTermsOpen(false)}>
          <TermsContent />
        </Sheet>
      ) : null}

      {helpSpreadOpen ? <HelpSpread onClose={() => setHelpSpreadOpen(false)} /> : null}
    </Sheet>
  );
}
