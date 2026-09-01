import { useRef, useState } from 'react';
import { useTracker } from './state';
import { canSync } from '../../state/cloudSync';
import type { Session } from '../../auth/session';
import { money } from '../../domain/format';
import { addMonths, formatMonth, monthRange, monthsOfYear, todayMonth } from '../../domain/months';
import {
  rulesFor, isExactYear, knownYears, mileageRatesForYear, TWP_SELF_EMPLOYMENT_HOURS
} from '../../domain/rules';
import { TRIAL_MONTH_LIMIT, ROLLING_WINDOW } from '../../domain/trialWork';
import { CloudIcon, DownloadIcon, TrashIcon, UploadIcon, ChevronRightIcon } from './Icons';
import { HelpSpread } from './HelpSpread';
import { SheetSurface } from './SheetSurface';
import { TermsViewSheet } from './TermsViewSheet';
import { TwpStatusControl } from './TwpStatusControl';

export function SettingsSheet({
  onClose,
  session
}: {
  onClose: () => void;
  session?: Session | null;
}) {
  const { data, ui, setPriorTrialMonths } = useTracker();
  const [help, setHelp] = useState(false);
  const [pickingPrior, setPickingPrior] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  if (help) return <HelpSpread onBack={() => setHelp(false)} onClose={onClose} />;

  if (termsOpen) {
    return <TermsViewSheet acceptedAt={ui.termsAcceptedAt} onClose={() => setTermsOpen(false)} />;
  }

  if (pickingPrior) {
    return (
      <PriorMonthsPicker
        selected={data.priorTrialMonths}
        onSave={(months) => { setPriorTrialMonths(months); setPickingPrior(false); }}
        onBack={() => setPickingPrior(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <SheetSurface label="App settings" eyebrow="Tracker" title="App settings" onClose={onClose}>
      <SettingsMainContent
        session={session}
        onPickPrior={() => setPickingPrior(true)}
        onHelp={() => setHelp(true)}
        onTerms={() => setTermsOpen(true)}
      />
    </SheetSurface>
  );
}

type SettingsTab = 'status' | 'appearance' | 'data' | 'about';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
  { id: 'about', label: 'About' }
];

function SettingsMainContent({
  session,
  onPickPrior,
  onHelp,
  onTerms
}: {
  session?: Session | null;
  onPickPrior: () => void;
  onHelp: () => void;
  onTerms: () => void;
}) {
  const {
    data, ui, setUi, downloadJson, importFile, clearYear, setTwpAssessment
  } = useTracker();
  const [tab, setTab] = useState<SettingsTab>('status');
  const fileRef = useRef<HTMLInputElement>(null);
  const rules = rulesFor(ui.year);
  const mileage = mileageRatesForYear(ui.year);
  const phase = data.twpAssessment.state;
  const checkedOn = () => new Date().toISOString().slice(0, 10);

  return (
    <>
          {/* Navigation chrome — which section of the page this is, not a
            * setting's value, so it deliberately does not look like
            * .segmented/.seg (an underline strip instead of a filled pill
            * group, so the two kinds of control read as different things). */}
          <div className="settings-tabs" role="tablist" aria-label="Settings section">
            {SETTINGS_TABS.map((t) => (
              <button
                className="settings-tabs__btn"
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'status' && (
          <>
          <div className="field">
            <span className="eyebrow">What should the tracker watch?</span>
            <TwpStatusControl
              variant="segmented"
              state={phase}
              onChange={(state) => setTwpAssessment({
                state,
                basis: state === 'unknown'
                  ? 'unconfirmed'
                  : data.twpAssessment.basis === 'ssa-record' ? 'ssa-record' : 'personal-records',
                checkedOn: state === 'unknown' ? undefined : checkedOn()
              })}
            />
            {phase === 'remaining' ? (
              <div className="warning">
                <div className="warning__bar" />
                <div className="warning__body">
                  <div className="warning__title">Confirm this before relying on it</div>
                  <div className="warning__text">
                    Do not choose “TWP remains” from memory alone. Review earlier
                    work years, benefit letters, or your SSA record — the app
                    will not infer status from an empty history, and getting
                    this wrong risks a bad SGA/TWP recommendation later.
                  </div>
                </div>
              </div>
            ) : (
              <p className="help-note">
                Do not choose “TWP remains” from memory alone. Review earlier work
                years, benefit letters, or your SSA record. The app will not infer
                status from an empty history.
              </p>
            )}
          </div>

          {phase !== 'unknown' ? (
            <div className="field">
              <span className="eyebrow">How was this checked?</span>
              <div className="segmented">
                <button
                  type="button"
                  aria-pressed={data.twpAssessment.basis === 'personal-records'}
                  onClick={() => setTwpAssessment({
                    ...data.twpAssessment,
                    basis: 'personal-records',
                    checkedOn: checkedOn()
                  })}
                >
                  My records
                </button>
                <button
                  type="button"
                  aria-pressed={data.twpAssessment.basis === 'ssa-record'}
                  onClick={() => setTwpAssessment({
                    ...data.twpAssessment,
                    basis: 'ssa-record',
                    checkedOn: checkedOn()
                  })}
                >
                  SSA record
                </button>
              </div>
            </div>
          ) : null}

          <div className="field">
            <span className="eyebrow">{ui.year} working limit{phase === 'unknown' ? 's' : ''}</span>
            <div className="rows">
              {phase !== 'remaining' ? (
                <div className="rows__row">
                  <span className="rows__label">Substantial gainful activity</span>
                  <span className="rows__value">{money(rules.sga)}</span>
                </div>
              ) : null}
              {phase !== 'complete' ? (
                <div className="rows__row">
                  <span className="rows__label">Trial work month</span>
                  <span className="rows__value">{money(rules.trialWork)}</span>
                </div>
              ) : null}
              {mileage.map((period) => (
                <div className="rows__row" key={period.fromMonth}>
                  <span className="rows__label">
                    Mileage rate{mileage.length > 1
                      ? ` · ${period.fromMonth === 1 ? 'Jan–Jun' : 'Jul–Dec'}`
                      : ''}
                  </span>
                  <span className="rows__value">
                    ${period.rate.toFixed(3).replace(/0$/, '')}
                    <span className="rows__unit">/mi</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="help-note">
              {isExactYear(ui.year)
                ? 'Set by SSA and the IRS. Published figures for ' + ui.year + '.'
                : 'No published figures for ' + ui.year + ' yet — these are the nearest known year\'s.'}
            </p>
          </div>

          {phase === 'remaining' ? <div className="field">
            <span className="eyebrow">Trial work months already used</span>
            <button
              className="rows rows--nav"
              type="button"
              onClick={onPickPrior}
            >
              <div className="rows__row">
                <div className="grow">
                  <div className="rows__label">Before this tracker</div>
                  <div className="help-note">
                    {data.priorTrialMonths.length
                      ? data.priorTrialMonths.map((m) => formatMonth(m)).join(', ')
                      : 'None recorded'}
                  </div>
                </div>
                <span className="rows__value">{data.priorTrialMonths.length}</span>
                <ChevronRightIcon size={16} />
              </div>
            </button>
            <p className="help-note">
              To complete the trial work period, {TRIAL_MONTH_LIMIT} service months
              {' '}must fall inside a rolling {ROLLING_WINDOW}-month window. Older months
              can stop counting only before the ninth is reached. Once completed, the
              trial work period does not restart.
            </p>
          </div> : phase === 'complete' ? (
            <p className="help-note">TWP used up · SGA mode is active.</p>
          ) : null}

          <button
            className="rows rows--nav"
            type="button"
            onClick={onHelp}
          >
            <div className="rows__row">
              <span className="rows__label rows__label--strong">How income spreads</span>
              <ChevronRightIcon size={16} />
            </div>
          </button>
          </>
          )}

          {tab === 'data' && <CloudSyncField session={session} />}

          {tab === 'appearance' && (
          <div className="field">
            <span className="eyebrow">Appearance</span>
            <div className="segmented" role="group" aria-label="Theme">
              {([
                ['system', 'System'],
                ['light', 'Light'],
                ['dark', 'Dark']
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={ui.theme === id}
                  onClick={() => setUi({ theme: id })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="glass-slider">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={ui.glassStrength}
                aria-label="Glass opacity"
                onChange={(e) => setUi({ glassStrength: Number(e.target.value) })}
              />
              <span className="num glass-slider__value">{ui.glassStrength}%</span>
            </div>
            <p className="help-note">
              System follows the device. Glass is how opaque the header, menus,
              and sheets like this one are — 0 is see-through, 100 is flat.
            </p>
          </div>
          )}

          {tab === 'data' && (
          <div className="field">
            <span className="eyebrow">Your data</span>
            <div className="stack-col">
              <button className="tonal-button button--start" type="button" onClick={downloadJson}>
                <DownloadIcon size={17} /> Export tracker JSON
              </button>
              <button className="tonal-button button--start" type="button" onClick={() => fileRef.current?.click()}>
                <UploadIcon size={17} /> Import tracker JSON
              </button>
              <button className="danger-button button--start" type="button" onClick={() => clearYear(ui.year)}>
                <TrashIcon size={17} /> Clear {ui.year} data
              </button>
              <p className="help-note">
                Removes entered income, hours, and paychecks for {ui.year} from every
                stream. It does not touch app settings or layout preferences.
              </p>
              <input
                ref={fileRef}
                className="visually-hidden"
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="help-note">
              Everything is stored on this device. Export is the only copy that
              leaves it.
            </p>
          </div>
          )}

          {tab === 'about' && (
          <button
            className="rows rows--nav"
            type="button"
            onClick={onTerms}
          >
            <div className="rows__row">
              <span className="rows__label rows__label--strong">Terms & privacy</span>
              <ChevronRightIcon size={16} />
            </div>
          </button>
          )}
    </>
  );
}

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + (min === 1 ? ' minute ago' : ' minutes ago');
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
  const day = Math.round(hr / 24);
  return day + (day === 1 ? ' day ago' : ' days ago');
}

/**
 * Off by default, one flagged account, and every step is something the
 * person did on purpose: turning it on means reading terms first, turning
 * it off means a real deletion from Firebase, not a pause — with a backup
 * handed over the moment that happens, since the deletion has no undo.
 */
function CloudSyncField({ session }: { session?: Session | null }) {
  const { ui, setCloudSyncEnabled, downloadJson, cloudSyncStatus, cloudLastSyncedAt } = useTracker();
  const [step, setStep] = useState<'idle' | 'consent' | 'confirm-off'>('idle');
  const [confirmText, setConfirmText] = useState('');

  if (!canSync(session?.email)) return null;

  const enabled = ui.cloudSyncEnabled;

  return (
    <div className="field">
      <span className="eyebrow">Cloud sync</span>

      <button
        className="lock-toggle"
        type="button"
        aria-pressed={enabled}
        onClick={() => {
          setConfirmText('');
          if (step !== 'idle') { setStep('idle'); return; }
          setStep(enabled ? 'confirm-off' : 'consent');
        }}
      >
        <CloudIcon size={15} />
        {enabled ? 'Cloud sync is on' : 'Cloud sync is off'}
      </button>

      {enabled && step === 'idle' ? (
        <p className="help-note">
          {cloudSyncStatus === 'syncing' && 'Syncing…'}
          {cloudSyncStatus === 'error' && 'Could not reach Firebase — your data is safe on this device and will sync once it can.'}
          {cloudSyncStatus === 'synced' && (
            'Cloud is online and synced'
            + (cloudLastSyncedAt ? ' · last synced ' + timeAgo(cloudLastSyncedAt) : '')
          )}
        </p>
      ) : null}

      {step === 'consent' ? (
        <div className="warning">
          <div className="warning__bar" />
          <div className="warning__body">
            <div className="warning__title">Before you turn this on</div>
            <div className="warning__text">
              Your tracker data — every stream, month, and paycheck — will be stored in
              Firebase under this account instead of staying only on this device. That
              is what lets a second device see it after signing in. Turning this off
              again deletes the Firebase copy; it does not pause it.
            </div>
            <div className="button-row">
              <button
                className="filled-button"
                type="button"
                onClick={() => { setCloudSyncEnabled(true); setStep('idle'); }}
              >
                I agree — turn on
              </button>
              <button className="text-button" type="button" onClick={() => setStep('idle')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'confirm-off' ? (
        <div className="warning">
          <div className="warning__bar" />
          <div className="warning__body">
            <div className="warning__title">This deletes the Firebase copy</div>
            <div className="warning__text">
              Turning cloud sync off <strong>deletes</strong> your data from Firebase —
              this is not a pause, and it cannot be undone. A backup downloads
              automatically the moment you confirm. Type DELETE to continue.
            </div>
            <input
              className="num-input confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
            <div className="button-row">
              <button
                className="danger-button"
                type="button"
                disabled={confirmText !== 'DELETE'}
                onClick={() => {
                  downloadJson();
                  setCloudSyncEnabled(false);
                  setStep('idle');
                  setConfirmText('');
                }}
              >
                Download backup &amp; delete
              </button>
              <button className="text-button" type="button" onClick={() => { setStep('idle'); setConfirmText(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Pick the actual months, because a count cannot answer a rolling window. */
function PriorMonthsPicker({
  selected, onSave, onBack, onClose
}: {
  selected: string[];
  onSave: (months: string[]) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <SheetSurface
      label="Prior trial work months"
      eyebrow="App settings"
      title="Trial work months"
      onBack={onBack}
      onClose={onClose}
    >
      <PriorMonthsContent selected={selected} onSave={onSave} />
    </SheetSurface>
  );
}

function PriorMonthsContent({
  selected,
  onSave
}: {
  selected: string[];
  onSave: (months: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [quickCount, setQuickCount] = useState('');
  const years = knownYears().slice().reverse();

  const toggle = (key: string) => {
    setPicked((current) =>
      current.includes(key) ? current.filter((m) => m !== key) : [...current, key]
    );
  };

  const quickFill = () => {
    const n = Math.max(0, Math.min(TRIAL_MONTH_LIMIT, Math.round(Number(quickCount) || 0)));
    if (!n) return;
    const end = addMonths(todayMonth(), -1);
    const start = addMonths(end, -(n - 1));
    setPicked(monthRange(start, end));
  };

  return (
    <>
          <div className="field">
            <span className="eyebrow">Quick fill</span>
            <div className="inline-row">
              <input
                className="num-input inline-row__count"
                type="text"
                inputMode="numeric"
                placeholder="0"
                aria-label="TWP months already used"
                value={quickCount}
                onChange={(e) => setQuickCount(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <button className="tonal-button" type="button" onClick={quickFill}>
                Fill in that many months
              </button>
            </div>
            <p className="help-note">
              Fills the most recent months before now, up to {TRIAL_MONTH_LIMIT}. These
              become real months, the same as tapping them below by hand — so unlike a
              stored count, they age out of the 60-month window correctly over time.
              Check them and correct any that are wrong before saving.
            </p>
          </div>

          <p className="help-note">
            Tap months where earnings exceeded that year's TWP amount, or where
            self-employment exceeded {TWP_SELF_EMPLOYMENT_HOURS} hours. Your benefit
            letters or SSA record can help verify them.
          </p>

          {years.map((year) => (
            <div className="field" key={year}>
              <span className="eyebrow">{year} · over {money(rulesFor(year).trialWork)}</span>
              <div className="month-squares">
                {monthsOfYear(year).map((month) => {
                  const on = picked.includes(month);
                  return (
                    <button
                      className={'month-square month-square--pick' + (on ? ' month-square--spent' : ' month-square--empty')}
                      key={month}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(month)}
                    >
                      <span className="month-square__label">
                        {formatMonth(month).slice(0, 3).toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button className="filled-button" type="button" onClick={() => onSave(picked)}>
            Save {picked.length} month{picked.length === 1 ? '' : 's'}
          </button>
    </>
  );
}
