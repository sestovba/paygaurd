import { useState } from 'react';
import type { ReactNode } from 'react';
import type { MonthKey } from '../../domain/types';
import { TrackerProvider, useTracker } from './state';
import { useAuth } from '../../auth/useAuth';
import { SignInScreen } from './SignInScreen';
import { Header } from './Header';
import { StreamsSection, ArchivedStreams } from './StreamsSection';
import { TotalsByMonth } from './TotalsByMonth';
import { MonthSquares } from './MonthSquares';
import { StatusSection } from './StatusSection';
import { SettingsSheet } from './SettingsSheet';
import { StreamSettingsSheet } from './StreamSettingsSheet';
import { MonthSheet } from './MonthSheet';
import { ToastStack } from './Toast';
import {
  CheckIcon, ChevronDownIcon, CollapseAllIcon, ExpandAllIcon,
  GridIcon, PlusIcon
} from './Icons';
import { AnchoredPopover, useAnchoredPopover } from './Popover';
import { useIsWide, useViewportBand } from './useIsWide';
import { DEFAULT_VIEWPORTS } from './state';
import type { Session } from '../../auth/session';
import { money } from '../../domain/format';
import { monthStatus, yearTotal } from '../../domain/earnings';
import { benefitPhase, trialWorkStatus } from '../../domain/trialWork';
import { monthsOfYear, todayMonth, yearOf } from '../../domain/months';
import { TwpStatusControl } from './TwpStatusControl';
import { TermsGate } from './TermsGate';
import { TERMS_VERSION } from '../../domain/legal';
import { canSync, saveConsentRecord } from '../../state/cloudSync';
import { useSlabBounce } from './useSlabBounce';
import { useAppearance } from './appearance';

export default function App() {
  const auth = useAuth();

  if (auth.locked) return <SignInScreen auth={auth} />;

  return (
    <TrackerProvider session={auth.session}>
      <TrackerApp session={auth.session} onSignOut={auth.signOut} />
    </TrackerProvider>
  );
}

function TrackerApp({
  session,
  onSignOut
}: {
  session: Session | null;
  onSignOut: () => void;
}) {
  const {
    data, ui, setUi, hasData, addStream, setAllCollapsed, setTwpAssessment
  } = useTracker();

  // Theme + glass live on <html> so portaled menus/sheets inherit them.
  useAppearance(ui);

  const wide = useIsWide();
  const viewport = useViewportBand();
  const ongoing = data.streams.filter((stream) => stream.lifecycle === 'active');
  const archivedCount = data.streams.filter((stream) => stream.lifecycle !== 'active').length;

  // Collapsed-section glance summaries — only ever shown while closed, so a
  // reader can tell what's inside without opening it.
  const activeAside = ongoing.length
    ? ongoing.length + (ongoing.length === 1 ? ' stream' : ' streams')
    : 'None yet';
  const monthsAside = money(yearTotal(data, ui.year)) + ' this year';
  const statusAsOf = yearOf(todayMonth()) === ui.year ? todayMonth() : monthsOfYear(ui.year)[11];
  const statusPhase = benefitPhase(data, statusAsOf);
  const statusAside = statusPhase === 'trialWork'
    ? trialWorkStatus(data, statusAsOf).remaining + ' TWP left'
    : statusPhase === 'sga'
      ? monthsOfYear(ui.year).filter((m) => monthStatus(data, m).overSga).length + ' over SGA'
      : 'Not confirmed';

  // Mixed state behaves like a true hide/show toggle: if anything is visible,
  // Hide all closes it; Show all appears only when every stream is closed.
  const allCollapsed = ongoing.length > 0
    && ongoing.every((s) => ui.collapsed[s.id] === true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streamSettingsId, setStreamSettingsId] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<MonthKey | null>(null);
  const [hovered, setHovered] = useState<MonthKey | null>(null);

  // Signed-out / local-only use is unaffected — there's no identity to
  // attach consent to, so the gate only ever appears once someone signs in.
  if (session && ui.termsAcceptedVersion !== TERMS_VERSION) {
    return (
      <TermsGate
        onAgree={() => {
          const acceptedAt = new Date().toISOString();
          setUi({ termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: acceptedAt });
          if (canSync(session.email)) {
            saveConsentRecord(session.uid, TERMS_VERSION, acceptedAt).catch(() => {
              // Offline, or rules not deployed yet — local acceptance still stands.
            });
          }
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Header
        session={session}
        onSignOut={onSignOut}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMonth={setOpenMonth}
      />

      <div className="app-main">
        {hasData ? (
          <div className="stack">
            <Section
              className="section--active"
              title="Active"
              open={ui.streamsOpen}
              onToggle={() => setUi({ streamsOpen: !ui.streamsOpen })}
              aside={!ui.streamsOpen ? activeAside : undefined}
              action={ui.streamsOpen ? (
                <div className="stream-section-actions">
                  <button
                    className="icon-button icon-button--muted"
                    type="button"
                    aria-label={allCollapsed ? 'Expand all' : 'Collapse all'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (allCollapsed) {
                        setAllCollapsed(false);
                        setUi({ expandAllAsStack: false });
                      } else {
                        setAllCollapsed(true);
                        setUi({ expandAllAsStack: false });
                      }
                    }}
                  >
                    {allCollapsed ? <ExpandAllIcon size={17} /> : <CollapseAllIcon size={17} />}
                  </button>
                  {/* layout changer — hidden; restore by removing `false &&` */}
                  {false && (
                  <StreamViewMenu
                    customize={ui.customizeLayout}
                    onCustomize={(on) => {
                      if (on) {
                        setUi({
                          customizeLayout: true,
                          expandAllAsStack: false,
                          ...DEFAULT_VIEWPORTS[viewport]
                        });
                      } else {
                        setUi({ customizeLayout: false, expandAllAsStack: false });
                      }
                    }}
                    onChoose={() => {
                      setUi({
                        layout: 'carousel',
                        carouselArrange: 'grid',
                        touchLayout: 'grid',
                        expandAllAsStack: false
                      });
                    }}
                  />
                  )}
                </div>
              ) : null}
            >
              <StreamsSection
                hovered={hovered}
                onHover={setHovered}
                onStreamSettings={setStreamSettingsId}
                onOpenMonth={setOpenMonth}
              />
              {archivedCount ? <ArchivedStreams onStreamSettings={setStreamSettingsId} /> : null}
            </Section>

            <Section
              /* The card inside carries the full title; repeating it on
                 the section heading said the same thing twice. */
              className="section--months"
              title="Months"
              open={ui.monthsOpen}
              onToggle={() => setUi({ monthsOpen: !ui.monthsOpen })}
              aside={!ui.monthsOpen ? monthsAside : undefined}
            >
              {wide ? (
                <TotalsByMonth hovered={hovered} onHover={setHovered} onOpenMonth={setOpenMonth} />
              ) : (
                <MonthSquares onOpenMonth={setOpenMonth} />
              )}
            </Section>

            <Section
              className="section--status"
              title="Status"
              open={ui.statusOpen}
              onToggle={() => setUi({ statusOpen: !ui.statusOpen })}
              aside={!ui.statusOpen ? statusAside : undefined}
            >
              <StatusSection />
            </Section>
          </div>
        ) : (
          <div className="app-empty">
            <div>
              <div className="app-empty__title">Start with your benefit phase</div>
              <p className="app-empty__note">
                The tracker should not guess whether trial work months remain.
                Choose what your records support, then add income.
              </p>
              <TwpStatusControl
                variant="seg"
                wrapperClassName="onboarding-phase"
                state={data.twpAssessment.state}
                onChange={(state) => setTwpAssessment({
                  state,
                  basis: state === 'unknown' ? 'unconfirmed' : 'personal-records',
                  checkedOn: state === 'unknown' ? undefined : new Date().toISOString().slice(0, 10)
                })}
              />
              {data.twpAssessment.state === 'remaining' ? (
                <div className="warning warning--onboarding">
                  <div className="warning__bar" />
                  <div className="warning__body">
                    <div className="warning__title">Confirm this before relying on it</div>
                    <div className="warning__text">
                      “TWP remains” should be based on prior work years, benefit
                      letters, or an SSA record — not an empty tracker. Choosing
                      it from memory risks a wrong SGA/TWP recommendation later.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="app-empty__actions">
              <button className="filled-button" type="button" onClick={() => setStreamSettingsId(addStream('w2'))}>
                <PlusIcon size={16} /> W-2 job
              </button>
              <button className="tonal-button" type="button" onClick={() => setStreamSettingsId(addStream('ten99'))}>
                <PlusIcon size={16} /> 1099 work
              </button>
              <button className="text-button" type="button" onClick={() => setSettingsOpen(true)}>
                Import tracker JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {settingsOpen ? <SettingsSheet onClose={() => setSettingsOpen(false)} session={session} /> : null}
      {streamSettingsId ? (
        <StreamSettingsSheetById id={streamSettingsId} onClose={() => setStreamSettingsId(null)} />
      ) : null}
      {openMonth ? <MonthSheet month={openMonth} onClose={() => setOpenMonth(null)} /> : null}

      <ToastStack />
    </div>
  );
}

function StreamViewMenu({
  customize,
  onCustomize,
  onChoose
}: {
  customize: boolean;
  onCustomize: (on: boolean) => void;
  onChoose: (view: 'grid') => void;
}) {
  const anchor = useAnchoredPopover();
  const current = 'grid';
  const options: Array<{
    id: 'grid';
    label: string;
    hint: string;
    icon: ReactNode;
  }> = [
    {
      id: 'grid',
      label: 'Grid',
      hint: 'Same cards, wrapped',
      icon: <GridIcon size={17} />
    }
  ];
  const currentOption = options.find((option) => option.id === current);

  return (
    <>
      <button
        ref={anchor.triggerRef}
        className="icon-button icon-button--muted"
        type="button"
        aria-haspopup="menu"
        aria-expanded={anchor.open}
        aria-label={'View: ' + (currentOption?.label ?? 'Grid')}
        onClick={anchor.toggle}
      >
        {currentOption?.icon}
      </button>
      <AnchoredPopover
        anchor={anchor}
        width={240}
        className="view-menu"
        label="Layout"
        title="Layout"
        role="menu"
        showChrome
      >
        <label className="view-customize">
          <input
            type="checkbox"
            checked={customize}
            onChange={(event) => onCustomize(event.target.checked)}
          />
          Customize layout
        </label>
        {options.map((option) => (
          <button
            className={
              'view-option'
              + (option.id === current ? ' view-option--on' : '')
            }
            key={option.id}
            type="button"
            role="menuitem"
            aria-current={option.id === current ? 'true' : undefined}
            onClick={() => {
              onChoose(option.id);
              anchor.close();
            }}
          >
            {option.icon}
            <span className="view-option__text">
              <span className="view-option__label">{option.label}</span>
              <span className="view-option__hint">{option.hint}</span>
            </span>
            {option.id === current ? (
              <CheckIcon className="view-option__check" size={16} />
            ) : null}
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}

function StreamSettingsSheetById({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useTracker();
  const stream = data.streams.find((s) => s.id === id);
  if (!stream) return null;
  return <StreamSettingsSheet stream={stream} onClose={onClose} />;
}

function Section({
  title, open, onToggle, action, aside, children, className
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  aside?: string;
  className?: string;
  children: ReactNode;
}) {
  const { bounce, onAnimationEnd } = useSlabBounce(open);

  return (
    <section
      className={
        'section'
        + (open ? ' section--open' : '')
        + (bounce ? ' slab-bounce' : '')
        + (className ? ' ' + className : '')
      }
      onAnimationEnd={onAnimationEnd}
    >
      <div className="section__bar">
        <button className="section__head" type="button" aria-expanded={open} onClick={onToggle}>
          <span className="disclosure" aria-hidden="true">
            <ChevronDownIcon
              className={'section__chevron' + (open ? '' : ' section__chevron--closed')}
              size={16}
            />
          </span>
          <span className="section__title">{title}</span>
          {aside ? <span className="section__aside">{aside}</span> : null}
        </button>
        {action ? <div className="section__actions">{action}</div> : null}
      </div>
      {open ? children : null}
    </section>
  );
}
