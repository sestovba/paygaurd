import { useRef, useState } from 'react';
import {
  ArrowRight, Cloud, CloudOff, Crosshair, Download, FileText, HelpCircle, LayoutTemplate,
  LogOut, ShieldCheck, Trash2, Upload
} from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { displayNameFor, initialsFor } from '../auth/session';
import type { LayoutMode, LedgerTheme } from '../state/storage';
import { InfoNote } from './InfoNote';
import { Sheet } from './Sheet';
import { Segmented, SwatchPicker, Switch } from './ui';
import { TermsContent } from './TermsContent';
import { HelpSpread } from './HelpSpread';
import { LAYOUTS, LayoutSwitcher } from './LayoutSwitcher';

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

function AccountSection() {
  const { session, signOut, canSync, cloudSyncEnabled, cloudSyncStatus, setCloudSyncEnabled } = useTracker();
  const [termsOpen, setTermsOpen] = useState(false);

  if (!session) {
    return (
      <InfoNote>
        Signed out — running with auth bypassed (local development). Everything stays on this device.
      </InfoNote>
    );
  }

  const statusLabel = cloudSyncStatus === 'syncing' ? 'Syncing…'
    : cloudSyncStatus === 'synced' ? 'Synced'
      : cloudSyncStatus === 'error' ? 'Sync error — retrying' : 'Off';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5">
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

      {canSync ? (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 text-base font-semibold">
              {cloudSyncEnabled ? <Cloud className="size-4" /> : <CloudOff className="size-4" />}
              Sync across devices
            </span>
            <span className="type-muted text-[0.9375rem]">{statusLabel}</span>
          </span>
          <Switch
            checked={cloudSyncEnabled}
            label="Toggle cloud sync"
            onChange={() => setCloudSyncEnabled(!cloudSyncEnabled)}
          />
        </label>
      ) : null}

      <LinkRow
        icon={<FileText className="size-5 text-muted-foreground" />}
        label="Terms & privacy"
        onClick={() => setTermsOpen(true)}
      />

      {termsOpen ? (
        <Sheet title="Terms, privacy, and liability" eyebrow="Legal" onClose={() => setTermsOpen(false)}>
          <TermsContent />
        </Sheet>
      ) : null}
    </div>
  );
}

export function SettingsPanel({
  theme, onTheme, onOpenStatus, onReset, onClose, variant = 'sheet', backLabel,
  layout, onLayoutChange, subTheme, onSubThemeChange
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
  /** Layouts with their own palette (PayGuard, Ledger) pass it here so the
   *  picker is reachable on mobile, where the header has no room for it. */
  subTheme?: LedgerTheme;
  onSubThemeChange?: (theme: LedgerTheme) => void;
}) {
  const { data, ui, setUi, replaceAll } = useTracker();
  const [helpSpreadOpen, setHelpSpreadOpen] = useState(false);
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
          alert('That file does not look like a PayGuard export.');
          return;
        }
        if (confirm('Import this file? It replaces every job and month currently on this device.')) {
          replaceAll(parsed);
        }
      } catch {
        alert('Could not read that file as JSON.');
      }
    };
    reader.readAsText(file);
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

      {/* Benefit status and How income works are primary information links */}
      <div className="flex flex-col gap-2">
        <LinkRow
          icon={<ShieldCheck className="size-5 text-muted-foreground" />}
          label="Benefit status"
          onClick={onOpenStatus}
        />
        <LinkRow
          icon={<HelpCircle className="size-5 text-muted-foreground" />}
          label="How income works"
          onClick={() => setHelpSpreadOpen(true)}
        />
      </div>

      {/* Focus mode switch */}
      <label className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5">
        <span className="flex min-w-0 gap-2">
          <Crosshair className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-base font-semibold">Focus mode</span>
            <span className="type-muted mt-0.5 block text-sm leading-snug">
              This month only, and nothing else to read.
            </span>
          </span>
        </span>
        <Switch
          checked={ui.focusMode}
          label="Focus mode"
          onChange={() => setUi({ focusMode: !ui.focusMode })}
        />
      </label>

      {/* Layout choice */}
      <LinkRow
        icon={<LayoutTemplate className="size-5 text-muted-foreground" />}
        label={`Layout · ${layoutName}`}
        onClick={() => setLayoutOpen(true)}
      />

      {/* Appearance: theme and palette */}
      <Segmented
        value={theme}
        columns={3}
        onChange={onTheme}
        options={[
          { id: 'system', label: 'System' },
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' }
        ]}
      />
      {subTheme && onSubThemeChange ? (
        <SwatchPicker
          label="Colour"
          value={subTheme}
          onChange={onSubThemeChange}
          options={SUB_THEMES}
        />
      ) : null}

      <Section title="Account">
        <AccountSection />
      </Section>

      {/* Data export/import and clear actions */}
      <Section title="Your data">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={exportJson}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-3 text-base font-semibold hover:bg-muted"
          >
            <Download className="size-4 text-muted-foreground" /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-3 text-base font-semibold hover:bg-muted"
          >
            <Upload className="size-4 text-muted-foreground" /> Import JSON
          </button>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-base font-semibold text-destructive hover:bg-destructive/15"
        >
          <Trash2 className="size-5" /> Clear all data on this device
        </button>

        <p className="type-muted mt-1 px-1 text-sm">
          Earnings stay on this device unless you turn on sync.
        </p>
      </Section>

      {layoutOpen ? (
        <Sheet title="Layout" eyebrow="Appearance" onClose={() => setLayoutOpen(false)}>
          <LayoutSwitcher value={layout} onChange={onLayoutChange} />
        </Sheet>
      ) : null}

      {helpSpreadOpen ? <HelpSpread onClose={() => setHelpSpreadOpen(false)} /> : null}
    </Sheet>
  );
}
