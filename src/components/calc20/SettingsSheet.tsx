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
import { CheckIcon, CloudIcon, DownloadIcon, TrashIcon, UploadIcon, ChevronRightIcon } from './Icons';
import { LAYOUT_GROUPS } from '../LayoutSwitcher';
import {
  SETTINGS_ROW, sectionsFor, type SettingsRowId, type SettingsSectionId
} from '../settingsModel';
import { SYNC_OFF_CONFIRM_WORD, useCloudSyncGuard } from '../../state/cloudSyncGuard';
import { HelpSpread } from './HelpSpread';
import { SheetSurface } from './SheetSurface';
import { TermsViewSheet } from './TermsViewSheet';
import { TwpStatusControl } from './TwpStatusControl';

/** Set by the standalone Calc20 build. Off everywhere else. */
const STANDALONE = import.meta.env.VITE_STANDALONE === '1';

export function SettingsSheet({
  onClose,
  session,
  initialTab
}: {
  onClose: () => void;
  session?: Session | null;
  initialTab?: SettingsSectionId;
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
        initialTab={initialTab}
        onPickPrior={() => setPickingPrior(true)}
        onHelp={() => setHelp(true)}
        onTerms={() => setTermsOpen(true)}
      />
    </SheetSurface>
  );
}

/* The tabs, their order and their names come from ../settingsModel, which
   the shared SettingsPanel reads too — there is one answer to "what is in
   Settings and in what order", and this screen and that one are two
   renderings of it rather than two opinions. A section this layout cannot
   draw anything for does not become a tab. */

function SettingsMainContent({
  session,
  initialTab,
  onPickPrior,
  onHelp,
  onTerms
}: {
  session?: Session | null;
  initialTab?: SettingsSectionId;
  onPickPrior: () => void;
  onHelp: () => void;
  onTerms: () => void;
}) {
  const {
    data, ui, setUi, downloadJson, importFile, clearYear, resetAll, setTwpAssessment,
    appLayout, setAppLayout
  } = useTracker();
  /* Not the first tab. The order says Account goes first — it is your
     account, and order is how often you touch a thing — but nobody opens
     Settings to look at a consent switch and a legal document. You land on
     the first tab there is something to change on. */
  const [tab, setTab] = useState<SettingsSectionId>(initialTab ?? 'appearance');
  const fileRef = useRef<HTMLInputElement>(null);
  const rules = rulesFor(ui.year);
  const mileage = mileageRatesForYear(ui.year);
  const phase = data.twpAssessment.state;
  const checkedOn = () => new Date().toISOString().slice(0, 10);

  /* What this layout can draw. No 'account' row — the header carries who you
     are signed in as and the way out. No 'palette' — this design system has
     one. The glass slider and the clear-one-year button go the other way:
     nothing else has them. */
  const rows: SettingsRowId[] = [
    ...(canSync(session?.email) ? ['sync' as const] : []),
    'terms',
    'focusMode',
    /* Not in the standalone export (vite.calc20.config.ts): that page is
       this layout and nothing else, so a switcher there would offer eight
       screens it has no code to draw. */
    ...(STANDALONE ? [] : ['layout' as const]),
    'theme',
    'glass',
    'export',
    'import',
    'clearYear',
    'clearAll',
    'benefitStatus',
    'howIncomeWorks'
  ];
  const sections = sectionsFor(rows);
  const active = sections.find((section) => section.id === tab) ?? sections[0];

  function renderRow(id: SettingsRowId) {
    switch (id) {
      case 'sync':
        return <CloudSyncField key={id} session={session} />;

      case 'terms':
        return (
          <button className="rows rows--nav" key={id} type="button" onClick={onTerms}>
            <div className="rows__row">
              <span className="rows__label rows__label--strong">{SETTINGS_ROW.terms.label}</span>
              <ChevronRightIcon size={16} />
            </div>
          </button>
        );

      /* Focus mode reached every layout except this one. It was wired all
         the way through the calc20 shim and honoured by every month list
         here — there was simply no switch on this screen, so in this layout
         it was on, permanently, with no way to see that or change it. */
      case 'focusMode':
        return (
          <div className="field" key={id}>
            <span className="eyebrow">{SETTINGS_ROW.focusMode.label}</span>
            <button
              className="lock-toggle"
              type="button"
              aria-pressed={ui.focusMode}
              onClick={() => setUi({ focusMode: !ui.focusMode, monthScope: undefined })}
            >
              <CheckIcon size={15} />
              {ui.focusMode ? 'Fewer things on screen' : 'Show everything'}
            </button>
            <p className="help-note">{SETTINGS_ROW.focusMode.help}</p>
          </div>
        );

      case 'theme':
        return (
          <div className="field" key={id}>
            <span className="eyebrow">{SETTINGS_ROW.theme.label}</span>
            <div className="segmented" role="group" aria-label="Theme">
              {([
                ['system', 'System'],
                ['light', 'Light'],
                ['dark', 'Dark']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={ui.theme === value}
                  onClick={() => setUi({ theme: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="help-note">System follows the device.</p>
          </div>
        );

      case 'glass':
        return (
          <div className="field" key={id}>
            <span className="eyebrow">{SETTINGS_ROW.glass.label}</span>
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
            <p className="help-note">{SETTINGS_ROW.glass.help}</p>
          </div>
        );

      case 'layout':
        return (
          <div className="field" key={id}>
            <span className="eyebrow">{SETTINGS_ROW.layout.label}</span>
            {/* Grouped, not flattened. Seven rows in a column is a list you
                read start to finish; three named groups is a question with
                three answers, and the heading tells you which one you are
                looking for before you read any of them. */}
            {LAYOUT_GROUPS.map((group) => (
              <div className="c20-layout-group" key={group.title}>
                <span className="c20-layout-group__title">{group.title}</span>
                {group.options.map((option) => {
                  const current = appLayout === option.id;
                  return (
                    <button
                      className="rows rows--nav"
                      key={option.id}
                      type="button"
                      aria-pressed={current}
                      onClick={() => setAppLayout(option.id)}
                    >
                      <div className="rows__row">
                        <div className="grow">
                          <div className="rows__label rows__label--strong">{option.label}</div>
                          <div className="help-note">{option.description}</div>
                        </div>
                        {current ? <CheckIcon size={16} /> : <ChevronRightIcon size={16} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
            <p className="help-note">
              Every layout reads and writes the same tracker — the jobs,
              months and paychecks below follow you between them. Saved on
              this device.
            </p>
          </div>
        );

      /* One field holds the four data buttons, drawn on 'export'; the rest
         of the ids in that section render nothing of their own. */
      case 'export':
        return (
          <div className="field" key={id}>
            <span className="eyebrow">Your data</span>
            <div className="stack-col">
              <button className="tonal-button button--start" type="button" onClick={downloadJson}>
                <DownloadIcon size={17} /> {SETTINGS_ROW.export.label}
              </button>
              <button className="tonal-button button--start" type="button" onClick={() => fileRef.current?.click()}>
                <UploadIcon size={17} /> {SETTINGS_ROW.import.label}
              </button>
              <button className="danger-button button--start" type="button" onClick={() => clearYear(ui.year)}>
                <TrashIcon size={17} /> Clear {ui.year} data
              </button>
              <p className="help-note">
                Removes the income, hours, and paychecks you entered for {ui.year},
                from every job. Your settings stay as they are.
              </p>
              <button className="danger-button button--start" type="button" onClick={resetAll}>
                <TrashIcon size={17} /> {SETTINGS_ROW.clearAll.label}
              </button>
              <p className="help-note">
                Every year, every job, and your trial work record. This one
                cannot be undone, so save a copy first.
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
        );
      case 'import':
      case 'clearYear':
      case 'clearAll':
        return null;

      case 'benefitStatus':
        return (
          <div key={id}>
            <div className="field">
              <span className="eyebrow">Where do you stand?</span>
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
                      Do not answer this from memory alone. Check
                      earlier work years, a benefit letter, or your Social
                      Security record — the app will not guess from an empty
                      history, and every limit after this one depends on it.
                    </div>
                  </div>
                </div>
              ) : (
                <p className="help-note">
                  Do not answer this from memory alone. Check earlier
                  work years, a benefit letter, or your Social Security record. The
                  app will not guess from an empty history.
                </p>
              )}
            </div>

            {phase !== 'unknown' ? (
              <div className="field">
                <span className="eyebrow">How do you know?</span>
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
              <span className="eyebrow">The {ui.year} figures</span>
              <div className="rows">
                {phase !== 'remaining' ? (
                  <div className="rows__row">
                    {/* SSA's own name for the rule, printed on screen. What
                        the reader has is a monthly limit; which rule it comes
                        from is not their problem. */}
                    <span className="rows__label">Your monthly limit</span>
                    <span className="rows__value">{money(rules.sga)}</span>
                  </div>
                ) : null}
                {phase !== 'complete' ? (
                  <div className="rows__row">
                    <span className="rows__label">Earn more than this and a month counts</span>
                    <span className="rows__value">{money(rules.trialWork)}</span>
                  </div>
                ) : null}
                {mileage.map((period) => (
                  <div className="rows__row" key={period.fromMonth}>
                    <span className="rows__label">
                      What a work mile is worth{mileage.length > 1
                        ? ` · ${period.fromMonth === 1 ? 'January to June' : 'July to December'}`
                        : ''}
                    </span>
                    <span className="rows__value">
                      ${period.rate.toFixed(3).replace(/0$/, '')}
                      <span className="rows__unit"> a mile</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="help-note">
                {isExactYear(ui.year)
                  ? 'These are the official numbers for ' + ui.year + '.'
                  : 'The official numbers for ' + ui.year + ' are not out yet, so these are last year\'s.'}
              </p>
            </div>

            {phase === 'remaining' ? (
              <div className="field">
                <span className="eyebrow">Trial work months already used</span>
                <button className="rows rows--nav" type="button" onClick={onPickPrior}>
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
                  You have {TRIAL_MONTH_LIMIT} trial work months, and they only count
                  {' '}while they fall inside the same rolling {ROLLING_WINDOW} months. An old
                  one can drop back out, but only before the ninth is reached. After
                  that they are gone for good.
                </p>
              </div>
            ) : null}
            {/* Once the trial months are spent the app never mentions them
                again — a line reporting that a resource is gone is exactly
                the stranded copy the review asked to cut. */}
          </div>
        );

      case 'howIncomeWorks':
        return (
          <button className="rows rows--nav" key={id} type="button" onClick={onHelp}>
            <div className="rows__row">
              <span className="rows__label rows__label--strong">{SETTINGS_ROW.howIncomeWorks.label}</span>
              <ChevronRightIcon size={16} />
            </div>
          </button>
        );

      default:
        return null;
    }
  }

  return (
    <>
      {/* Navigation chrome — which section of the page this is, not a
        * setting's value, so it deliberately does not look like
        * .segmented/.seg (an underline strip instead of a filled pill
        * group, so the two kinds of control read as different things). */}
      <div className="settings-tabs" role="tablist" aria-label="Settings section">
        {sections.map((section) => (
          <button
            className="settings-tabs__btn"
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active?.id === section.id}
            onClick={() => setTab(section.id)}
          >
            {section.title}
          </button>
        ))}
      </div>

      {active?.rows.map(renderRow)}
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
  /* The steps live in state/cloudSyncGuard so the shared SettingsPanel runs
     the same ones. They were written here first and only here, which meant
     the other nine layouts deleted the Firebase copy off a plain switch. */
  const guard = useCloudSyncGuard({
    enabled: ui.cloudSyncEnabled,
    setEnabled: setCloudSyncEnabled,
    backup: downloadJson
  });

  if (!canSync(session?.email)) return null;

  const enabled = ui.cloudSyncEnabled;

  return (
    <div className="field">
      <span className="eyebrow">{SETTINGS_ROW.sync.label}</span>

      <button
        className="lock-toggle"
        type="button"
        aria-pressed={enabled}
        onClick={guard.press}
      >
        <CloudIcon size={15} />
        {enabled ? 'Cloud sync is on' : 'Cloud sync is off'}
      </button>

      {enabled && guard.step === 'idle' ? (
        <p className="help-note">
          {cloudSyncStatus === 'syncing' && 'Syncing…'}
          {cloudSyncStatus === 'error' && 'Could not reach Firebase — your data is safe on this device and will sync once it can.'}
          {cloudSyncStatus === 'synced' && (
            'Cloud is online and synced'
            + (cloudLastSyncedAt ? ' · last synced ' + timeAgo(cloudLastSyncedAt) : '')
          )}
        </p>
      ) : null}

      {guard.step === 'consent' ? (
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
              <button className="filled-button" type="button" onClick={guard.turnOn}>
                I agree — turn on
              </button>
              <button className="text-button" type="button" onClick={guard.cancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {guard.step === 'confirm-off' ? (
        <div className="warning">
          <div className="warning__bar" />
          <div className="warning__body">
            <div className="warning__title">This deletes the Firebase copy</div>
            <div className="warning__text">
              Turning cloud sync off <strong>deletes</strong> your data from Firebase —
              this is not a pause, and it cannot be undone. A backup downloads
              automatically the moment you confirm. Type {SYNC_OFF_CONFIRM_WORD} to continue.
            </div>
            <input
              className="num-input confirm-input"
              type="text"
              value={guard.confirmText}
              onChange={(e) => guard.setConfirmText(e.target.value)}
              placeholder={SYNC_OFF_CONFIRM_WORD}
              aria-label={`Type ${SYNC_OFF_CONFIRM_WORD} to confirm`}
            />
            <div className="button-row">
              <button
                className="danger-button"
                type="button"
                disabled={!guard.canConfirmOff}
                onClick={guard.turnOffWithBackup}
              >
                Download backup &amp; delete
              </button>
              <button className="text-button" type="button" onClick={guard.cancel}>
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
                aria-label="Trial work months already used"
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
            Tap months where earnings went over that year's limit, or where
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
