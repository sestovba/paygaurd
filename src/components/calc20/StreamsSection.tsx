// Income streams.
//
// Same cards everywhere, in a wrapping grid. On a phone the grid is one column, so it already reads as a list. Both
// collapse and expand into the same pivot grid — on a phone it is one column
// with the month label left, which is exactly what the pivot layout is for.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MonthKey, Stream } from '../../domain/types';
import { useTracker } from './state';
import { money, hours as fmtHours, miles as fmtMiles } from '../../domain/format';
import { SOURCE_SHORT } from '../../domain/copy';
import {
  streamYearTotal, streamYearHours, streamYearMiles, streamsMissingMonth
} from '../../domain/earnings';
import { addMonths, formatMonth, todayMonth } from '../../domain/months';
import { MonthGrid, fieldsFor } from './MonthGrid';
import { EditableName } from './EditableName';
import { PaycheckLedger } from './PaycheckLedger';
import { AnnualTotalEntry } from './AnnualTotalEntry';
import {
  ArchiveIcon, ArchiveRestoreIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon,
  CloseIcon, CompactIcon, CopyIcon, ListIcon, LockIcon, MonthColumnsIcon, MoreIcon,
  PauseIcon, PlusIcon, RoomyIcon, SlidersIcon, TrashIcon, UnlockIcon, WarningIcon
} from './Icons';
import { AnchoredPopover, useAnchoredPopover } from './Popover';
import { useIsHandset, useViewportBand } from './useIsWide';
import { layoutFor } from './state';
import { useSlabBounce } from './useSlabBounce';

type FieldId = 'gross' | 'hours' | 'miles';

const DEFAULT_FIELDS: Record<Stream['type'], FieldId[]> = {
  w2: ['gross', 'hours'],
  ten99: ['gross', 'miles']
};

/* Was "W-2 · 120 hrs" and "1099 · net of expenses" — two tax-form names and
   one accounting phrase, on the line under every job's name.
   The type word itself is gone from here: the badge beside the name already
   says Employer or Gig work, and having both say it left the card reading
   "Employer / EMPLOYER · 0 HOURS". This line carries what the badge cannot —
   the hours, and what the miles took off. */
function subLine(stream: Stream, year: number): string {
  if (stream.type === 'w2') return fmtHours(streamYearHours(stream, year));
  const miles = streamYearMiles(stream, year);
  return miles > 0
    ? fmtMiles(miles) + ' taken off'
    : 'after your miles come off';
}

/* Was 'gross' / 'net' — the two words this product's copy rule bans by
   name, sitting under the largest figure on each job card. */
function totalLabel(stream: Stream): string {
  return stream.type === 'w2' ? 'before taxes' : 'after your miles';
}

/**
 * A weekly/biweekly schedule silently produces a 3-paycheck month, and only
 * an anchor date lets the app find it. Without one, the risk is invisible
 * rather than absent.
 */
function needsAnchorDate(stream: Stream): boolean {
  return stream.type === 'w2'
    && (stream.payFrequency === 'weekly' || stream.payFrequency === 'biweekly')
    && !stream.anchorDate;
}

function TypeBadge({ stream }: { stream: Stream }) {
  const anchor = useAnchoredPopover();
  const { updateStream } = useTracker();

  return (
    <>
      <button
        ref={anchor.triggerRef}
        className={'stream-card__type' + (stream.type === 'w2' ? ' stream-card__type--w2' : '')}
        type="button"
        aria-haspopup="menu"
        aria-expanded={anchor.open}
        aria-label={`This is ${SOURCE_SHORT[stream.type].toLowerCase()}. Change it`}
        onClick={anchor.toggle}
      >
        {SOURCE_SHORT[stream.type]}
      </button>
      <AnchoredPopover
        anchor={anchor}
        width={160}
        className="stream-menu"
        label="What kind of work is this?"
        title="What kind of work"
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => { anchor.close(); updateStream(stream.id, { type: 'w2' }); }}
        >
          <span className="menu-label">{SOURCE_SHORT.w2}</span>
          {stream.type === 'w2' ? <CheckIcon size={15} /> : null}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => { anchor.close(); updateStream(stream.id, { type: 'ten99' }); }}
        >
          <span className="menu-label">{SOURCE_SHORT.ten99}</span>
          {stream.type === 'ten99' ? <CheckIcon size={15} /> : null}
        </button>
      </AnchoredPopover>
    </>
  );
}

function StreamMenu({ stream, asChip, onSettings }: { stream: Stream; asChip?: boolean; onSettings: () => void }) {
  const anchor = useAnchoredPopover();
  const { ui, duplicateStream, removeStream, updateStream } = useTracker();
  const [view, setView] = useState<'main' | 'type'>('main');

  const close = () => { anchor.close(); setView('main'); };

  return (
    <>
      {asChip ? (
        <button
          ref={anchor.triggerRef}
          className={'archived-chip' + (anchor.open ? ' archived-chip--open' : '')}
          type="button"
          aria-label={`Actions for ${stream.name}`}
          aria-haspopup="menu"
          aria-expanded={anchor.open}
          onClick={anchor.toggle}
        >
          <span className="archived-chip__name">{stream.name}</span>
          <span className={
            'archived-chip__tag'
            + (stream.lifecycle === 'inactive' ? ' archived-chip__tag--paused' : ' archived-chip__tag--ended')
          }>
            {stream.lifecycle === 'inactive' ? 'Paused' : 'Ended'}
          </span>
          <span className="archived-chip__total">{money(streamYearTotal(stream, ui.year))}</span>
        </button>
      ) : (
        <button
          ref={anchor.triggerRef}
          className="icon-button icon-button--muted"
          type="button"
          aria-label={`Actions for ${stream.name}`}
          aria-haspopup="menu"
          aria-expanded={anchor.open}
          onClick={anchor.toggle}
        >
          <MoreIcon size={17} />
        </button>
      )}

      <AnchoredPopover
        anchor={anchor}
        width={196}
        className="stream-menu"
        label="Stream actions"
        title={view === 'type' ? 'Type' : stream.name}
        role="menu"
      >
        {view === 'type' ? (
          <>
            <button type="button" className="stream-menu__back" onClick={() => setView('main')}>
              <ChevronLeftIcon size={16} /><span>Back</span>
            </button>
            <button type="button" role="menuitem" onClick={() => { close(); updateStream(stream.id, { type: 'w2' }); }}>
              <span className="menu-label">{SOURCE_SHORT.w2}</span>
              {stream.type === 'w2' ? <CheckIcon size={15} /> : null}
            </button>
            <button type="button" role="menuitem" onClick={() => { close(); updateStream(stream.id, { type: 'ten99' }); }}>
              <span className="menu-label">{SOURCE_SHORT.ten99}</span>
              {stream.type === 'ten99' ? <CheckIcon size={15} /> : null}
            </button>
          </>
        ) : (
          <>
            <button type="button" role="menuitem" onClick={() => { close(); onSettings(); }}>
              <SlidersIcon size={17} /><span>Settings</span>
            </button>
            <button type="button" role="menuitem" onClick={() => setView('type')}>
              <span className="menu-label">Type</span>
              <span className="stream-menu__hint">{SOURCE_SHORT[stream.type]}</span>
              <ChevronRightIcon size={15} />
            </button>
            <button type="button" role="menuitem" onClick={() => { close(); duplicateStream(stream.id); }}>
              <CopyIcon size={17} /><span>Duplicate</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { close(); updateStream(stream.id, { locked: !stream.locked }); }}
            >
              {stream.locked ? <UnlockIcon size={17} /> : <LockIcon size={17} />}
              <span>{stream.locked ? 'Unlock' : 'Lock'}</span>
            </button>
            {stream.lifecycle !== 'inactive' ? (
              <button type="button" role="menuitem" onClick={() => { close(); updateStream(stream.id, { lifecycle: 'inactive' }); }}>
                <PauseIcon size={17} /><span>Mark paused</span>
              </button>
            ) : null}
            {stream.lifecycle !== 'completed' ? (
              <button type="button" role="menuitem" onClick={() => { close(); updateStream(stream.id, { lifecycle: 'completed' }); }}>
                <ArchiveIcon size={17} /><span>Mark ended</span>
              </button>
            ) : null}
            {stream.lifecycle !== 'active' ? (
              <button type="button" role="menuitem" onClick={() => { close(); updateStream(stream.id, { lifecycle: 'active' }); }}>
                <ArchiveRestoreIcon size={17} /><span>Return to ongoing</span>
              </button>
            ) : null}
            <button
              className="menu-danger"
              type="button"
              role="menuitem"
              disabled={stream.locked}
              title={stream.locked ? 'Unlock to remove' : undefined}
              onClick={() => { close(); removeStream(stream.id); }}
            >
              <TrashIcon size={17} /><span>Remove</span>
            </button>
          </>
        )}
      </AnchoredPopover>
    </>
  );
}

function MonthColAuto() {
  const { ui, setUi } = useTracker();
  const viewport = useViewportBand();
  const prefs = layoutFor(ui, viewport);
  const columnsAuto = prefs.monthColumnsAuto;
  const [dropOpen, setDropOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setDropOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [dropOpen]);

  return (
    <div
      ref={rootRef}
      className={'col-auto' + (dropOpen ? ' col-auto--open' : '')}
    >
      <label className="col-auto__toggle">
        <input
          className="col-auto__check"
          type="checkbox"
          checked={columnsAuto}
          onChange={(event) => {
            setUi(
              event.target.checked
                ? { monthColumnsAuto: true }
                : { monthColumnsAuto: false }
            );
          }}
        />
        <span className="col-auto__name">Auto</span>
      </label>
      <button
        className="col-auto__menu"
        type="button"
        aria-expanded={dropOpen}
        aria-label="Column width"
        onClick={(event) => {
          event.stopPropagation();
          setDropOpen((open) => !open);
        }}
      >
        <ChevronDownIcon
          className={'col-auto__chevron' + (dropOpen ? ' col-auto__chevron--open' : '')}
          size={12}
        />
      </button>
      {dropOpen ? (
        <div className="col-auto__drop" onClick={(event) => event.stopPropagation()}>
          <input
            type="range"
            min={-1}
            max={1}
            step={1}
            value={Math.max(-1, Math.min(1, prefs.monthColumnAdjustment))}
            aria-label="Month columns"
            aria-valuetext={`${2 + Math.max(-1, Math.min(1, prefs.monthColumnAdjustment))} columns`}
            onChange={(event) => setUi({
              monthColumnsAuto: false,
              monthColumnAdjustment: Number(event.target.value)
            })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function StreamsSection({
  hovered,
  onHover,
  onStreamSettings,
  onOpenMonth
}: {
  hovered: MonthKey | null;
  onHover: (month: MonthKey | null) => void;
  onStreamSettings: (id: string) => void;
  onOpenMonth: (month: MonthKey) => void;
}) {
  const { data, ui, setUi, addStream, updateStream, toggleCollapsed } = useTracker();
  const [fields, setFields] = useState<Record<string, FieldId[]>>({});
  const [openCell, setOpenCell] = useState<Record<string, MonthKey | null>>({});
  const [recentOpen, setRecentOpen] = useState<{ id: string; turn: number } | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(
    () => data.streams.find((stream) => stream.lifecycle === 'active')?.id ?? null
  );
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollSettleRef = useRef<number | null>(null);
  const carouselInitialised = useRef(false);

  const viewport = useViewportBand();
  const phone = viewport === 'phone';
  const handset = useIsHandset();
  const prefs = layoutFor(ui, viewport);
  const pivot = prefs.pivot;
  const columnsAuto = prefs.monthColumnsAuto;
  const layoutLocked = !ui.customizeLayout;
  // Carousel is not a layout option; the subsystem stays but always renders grid.
  const cardArrange = ((): 'grid' | 'carousel' => 'grid')();
  const ongoing = data.streams.filter((stream) => stream.lifecycle === 'active');
  const previousMonth = addMonths(todayMonth(), -1);
  const missingPrevious = previousMonth.startsWith(String(ui.year) + '-')
    ? streamsMissingMonth(ongoing, previousMonth)
    : [];
  const showMissingBanner = missingPrevious.length > 0
    && !ui.dismissedMissingMonths.includes(previousMonth);

  const density = prefs.density;

  const onlyOpen = (id: string): Record<string, boolean> => Object.fromEntries(
    data.streams.map((stream) => [stream.id, stream.id !== id])
  );

  const centerStream = (id: string) => {
    requestAnimationFrame(() => {
      itemRefs.current[id]?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    });
  };

  const activateCarouselStream = (id: string, center = true) => {
    setSelectedStreamId(id);
    if (cardArrange === 'carousel') setUi({ collapsed: onlyOpen(id) });
    if (center) centerStream(id);
  };

  useEffect(() => {
    if (!ongoing.length) {
      setSelectedStreamId(null);
      return;
    }
    if (!selectedStreamId || !ongoing.some((stream) => stream.id === selectedStreamId)) {
      setSelectedStreamId(ongoing[0].id);
    }
  }, [data.streams, selectedStreamId]);

  useEffect(() => {
    if (cardArrange !== 'carousel') return;
    const open = ongoing.find((stream) => !ui.collapsed[stream.id]);
    if (open && open.id !== selectedStreamId) setSelectedStreamId(open.id);
  }, [cardArrange, ui.collapsed, data.streams, selectedStreamId]);

  // Untouched collapse maps used to mean every card was open. The first
  // Carousel visit focuses one card, at every width.
  useEffect(() => {
    if (carouselInitialised.current || cardArrange !== 'carousel') return;
    carouselInitialised.current = true;
    if (!ongoing.length || !ongoing.every((stream) => !(stream.id in ui.collapsed))) return;
    const first = selectedStreamId ?? ongoing[0].id;
    setUi({ collapsed: onlyOpen(first) });
  }, [cardArrange, data.streams, selectedStreamId, setUi, ui.collapsed]);

  useEffect(() => () => {
    if (scrollSettleRef.current !== null) window.clearTimeout(scrollSettleRef.current);
  }, []);

  useEffect(() => {
    if (!recentOpen) return;
    const frame = requestAnimationFrame(() => {
      const target = itemRefs.current[recentOpen.id];
      target?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [recentOpen]);

  const toggleStream = (id: string) => {
    const opening = ui.collapsed[id] === true;
    setSelectedStreamId(id);
    if (cardArrange === 'carousel' && opening) setUi({ collapsed: onlyOpen(id) });
    else toggleCollapsed(id);
    if (opening) {
      setRecentOpen((current) => ({ id, turn: (current?.turn ?? 0) + 1 }));
    }
  };

  const fieldsOf = (stream: Stream): FieldId[] =>
    fields[stream.id] ?? DEFAULT_FIELDS[stream.type];

  const toggleField = (stream: Stream, id: FieldId) => {
    setFields((current) => {
      const active = current[stream.id] ?? DEFAULT_FIELDS[stream.type];
      const next = active.includes(id) ? active.filter((f) => f !== id) : [...active, id];
      // Never leave a stream with no fields — nothing left to type into.
      return { ...current, [stream.id]: next.length ? next : active };
    });
  };

  const gridFor = (stream: Stream) => {
    const adjustment = prefs.monthColumnAdjustment;
    return (
      <MonthGrid
        stream={stream}
        activeFields={fieldsOf(stream)}
        hovered={hovered}
        onHover={onHover}
        editing={false}
        locked={stream.locked}
        focusMonth={openCell[stream.id] ?? null}
        onEditMonth={(month) => {
          setOpenCell((c) => ({ ...c, [stream.id]: month }));
        }}
        pivot={pivot}
        columns="auto"
        columnAdjustment={adjustment}
        density={density}
        monthColumnsAuto={columnsAuto}
        handset={handset}
      />
    );
  };

  const chips = (stream: Stream) => {
    const active = fieldsOf(stream);
    return (
      <div
        className="ledger-seg"
        role="group"
        aria-label="Visible month fields"
        onClick={(e) => e.stopPropagation()}
      >
        {fieldsFor(stream).map((f) => (
          <button
            className={'ledger-seg__btn' + (active.includes(f.id) ? ' ledger-seg__btn--on' : '')}
            key={f.id}
            type="button"
            aria-pressed={active.includes(f.id)}
            title={active.includes(f.id) ? `Hide ${f.label}` : `Show ${f.label}`}
            onClick={() => toggleField(stream, f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
    );
  };

  const fieldChips = () => (
      <div className="stream-panel-fields">
        <div className="stream-panel-end">
          {layoutLocked ? null : (
            <>
              <div className="seg" role="group" aria-label="Month layout">
                <button
                  className={'seg__btn seg__btn--icon' + (pivot ? ' seg__btn--on' : '')}
                  type="button"
                  aria-pressed={pivot}
                  aria-label="Pivot row"
                  onClick={() => setUi({ pivot: true })}
                >
                  <ListIcon size={15} />
                </button>
                <button
                  className={'seg__btn seg__btn--icon' + (!pivot ? ' seg__btn--on' : '')}
                  type="button"
                  aria-pressed={!pivot}
                  aria-label="Pivot col"
                  onClick={() => setUi({
                    pivot: false,
                    ...(handset ? { monthColumnAdjustment: 0 } : {})
                  })}
                >
                  <MonthColumnsIcon size={15} />
                </button>
              </div>
              {pivot ? null : <MonthColAuto />}
            </>
          )}
        </div>
      </div>
    );

  const layoutFoot = (stream: Stream) => (
      <div className="stream-card__foot">
        {chips(stream)}
        <div className="stream-card__foot-end">
          <button
            className={'stream-panel-edit' + (density === 'compact' ? ' stream-panel-edit--on' : '')}
            type="button"
            aria-pressed={density === 'compact'}
            onClick={() => setUi({
              density: density === 'compact' ? 'comfortable' : 'compact',
              densityChosen: true
            })}
          >
            {density === 'compact' ? <CompactIcon size={14} /> : <RoomyIcon size={14} />}
            {density === 'compact' ? 'Compact' : 'Cozy'}
          </button>
          {/* "Hiding future" used to sit here, on the foot of every stream
              card — one app-wide preference drawn once per job. It is one
              control in the header now, and it says all four things it can
              do rather than two. */}
        </div>
      </div>
    );

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const containerClass = cardArrange === 'carousel'
    ? 'stream-carousel'
    : 'stream-grid';

  const selectedIndex = Math.max(
    0,
    ongoing.findIndex((stream) => stream.id === selectedStreamId)
  );

  const moveCarousel = (step: number) => {
    const next = Math.max(0, Math.min(ongoing.length - 1, selectedIndex + step));
    const stream = ongoing[next];
    if (stream) activateCarouselStream(stream.id);
  };

  const settleCarouselSelection = () => {
    if (scrollSettleRef.current !== null) window.clearTimeout(scrollSettleRef.current);
    scrollSettleRef.current = window.setTimeout(() => {
      const rail = carouselRef.current;
      if (!rail) return;
      const railRect = rail.getBoundingClientRect();
      const centre = railRect.left + railRect.width / 2;
      const nearest = ongoing.reduce<{ id: string; distance: number } | null>((best, stream) => {
        const rect = itemRefs.current[stream.id]?.getBoundingClientRect();
        if (!rect) return best;
        const distance = Math.abs(rect.left + rect.width / 2 - centre);
        return !best || distance < best.distance ? { id: stream.id, distance } : best;
      }, null);
      if (nearest && nearest.id !== selectedStreamId) activateCarouselStream(nearest.id, false);
    }, 120);
  };

  return (
    <div className="streams-section">
      {showMissingBanner ? (
        <div className="missing-month">
          <button className="missing-month__go" type="button" onClick={() => onOpenMonth(previousMonth)}>
            <strong>Update {formatMonth(previousMonth)}</strong>
            <span>No entry yet for {missingPrevious.map((stream) => stream.name).join(', ')}.</span>
          </button>
          <button
            className="missing-month__dismiss"
            type="button"
            aria-label={'Dismiss update for ' + formatMonth(previousMonth)}
            onClick={() => setUi({
              dismissedMissingMonths: ui.dismissedMissingMonths.includes(previousMonth)
                ? ui.dismissedMissingMonths
                : [...ui.dismissedMissingMonths, previousMonth]
            })}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ) : null}

      <div className={cardArrange === 'carousel' ? 'carousel-stage' : undefined}>
        {cardArrange === 'carousel' && ongoing.length > 1 ? (
          <>
            <button
              className="carousel-stage__arrow carousel-stage__arrow--prev"
              type="button"
              aria-label="Previous income stream"
              disabled={selectedIndex === 0}
              onClick={() => moveCarousel(-1)}
            >
              <ChevronLeftIcon size={26} />
            </button>
            {/* Job jump dropdown — parked while arrows sit on the card.
            <select
              className="carousel-jump__select"
              aria-label="Jump to income stream"
              value={ongoing[selectedIndex]?.id ?? ''}
              onChange={(event) => activateCarouselStream(event.target.value)}
            >
              {ongoing.map((stream, index) => (
                <option key={stream.id} value={stream.id}>{index + 1} of {ongoing.length} · {stream.name}</option>
              ))}
            </select>
            */}
            <button
              className="carousel-stage__arrow carousel-stage__arrow--next"
              type="button"
              aria-label="Next income stream"
              disabled={selectedIndex >= ongoing.length - 1}
              onClick={() => moveCarousel(1)}
            >
              <ChevronRightIcon size={26} />
            </button>
          </>
        ) : null}
        <div
          className={containerClass}
          ref={cardArrange === 'carousel' ? carouselRef : undefined}
          onScroll={cardArrange === 'carousel' ? settleCarouselSelection : undefined}
        >
        {ongoing.map((stream) => {
          const open = !ui.collapsed[stream.id];
          return (
              <StreamCardFrame
                key={stream.id}
                open={open}
                cardRef={(node) => { itemRefs.current[stream.id] = node; }}
                className={
                  'stream-card'
                  + (cardArrange === 'carousel' ? ' stream-card--carousel' : '')
                  + (cardArrange === 'grid' ? ' stream-card--grid' : '')
                  + (open ? ' stream-card--open' : '')
                }
              >
                <div
                  className="stream-card__head"
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggleStream(stream.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleStream(stream.id);
                    }
                  }}
                >
                  <span className="disclosure" aria-hidden="true">
                    <ChevronDownIcon
                      className={'section__chevron' + (open ? '' : ' section__chevron--closed')}
                      size={16}
                    />
                  </span>

                  <div className="stream-card__name-wrap" onClick={open && !phone ? stop : undefined}>
                    <div className="stream-card__name-row">
                      {!open || phone ? (
                        <span className="stream-card__name">{stream.name}</span>
                      ) : (
                        <EditableName
                          className="stream-card__name"
                          value={stream.name}
                          ariaLabel="Stream name"
                          onCommit={(next) => updateStream(stream.id, { name: next })}
                        />
                      )}
                      <TypeBadge stream={stream} />
                      {stream.locked ? (
                        <LockIcon className="stream-card__lock" size={13} aria-label="Locked" />
                      ) : null}
                    </div>
                    <span className="stream-card__meta">{subLine(stream, ui.year)}</span>
                  </div>

                  <div className="stream-card__right">
                    <div className="stream-card__totals">
                      <span className="stream-card__total">{money(streamYearTotal(stream, ui.year))}</span>
                      <span className="stream-card__total-label">{totalLabel(stream)}</span>
                    </div>
                    <span onClick={stop}>
                      <StreamMenu stream={stream} onSettings={() => onStreamSettings(stream.id)} />
                    </span>
                  </div>

                  {needsAnchorDate(stream) ? (
                    <span
                      className="stream-card__badge stream-card__badge--warn"
                      title="No payday set — can't warn about extra-paycheck months"
                    >
                      <WarningIcon size={11} />
                      <span className="stream-card__badge-text">
                        No payday set
                      </span>
                    </span>
                  ) : null}
                </div>

                {open ? (
                  <div className="stream-card__panel" onClick={stop}>
                    {fieldChips()}
                    {stream.type === 'ten99' ? (
                      <AnnualTotalEntry stream={stream} />
                    ) : null}
                    {gridFor(stream)}
                    <PaycheckLedger stream={stream} />
                    {layoutFoot(stream)}
                  </div>
                ) : null}
              </StreamCardFrame>
            );
        })}
        </div>
      </div>

      {cardArrange === 'carousel' && ongoing.length > 1 ? (
        <nav className="carousel-nav carousel-nav--below" aria-label="Income stream carousel">
          <div className="carousel-nav__dots" aria-label="Choose income stream">
            {ongoing.map((stream, index) => (
              <button
                className={'carousel-nav__dot' + (index === selectedIndex ? ' carousel-nav__dot--active' : '')}
                key={stream.id}
                type="button"
                aria-label={`Show ${stream.name}, ${index + 1} of ${ongoing.length}`}
                aria-current={index === selectedIndex ? 'page' : undefined}
                onClick={() => activateCarouselStream(stream.id)}
              />
            ))}
          </div>
        </nav>
      ) : null}

      <div className="stream-footer">
        <div className="stream-add">
          <AddButtons onAdd={(type) => onStreamSettings(addStream(type))} />
        </div>
      </div>
    </div>
  );
}

export function ArchivedStreams({ onStreamSettings }: { onStreamSettings: (id: string) => void }) {
  const { data } = useTracker();
  const archived = data.streams.filter((stream) => stream.lifecycle !== 'active');
  if (!archived.length) return null;
  return (
    <div className="archived-streams">
      <span className="archived-streams__title">Not ongoing</span>
      <div className="archived-streams__chips">
        {archived.map((stream) => (
          <StreamMenu
            key={stream.id}
            stream={stream}
            asChip
            onSettings={() => onStreamSettings(stream.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StreamCardFrame({
  open,
  cardRef,
  className,
  children
}: {
  open: boolean;
  cardRef: (node: HTMLDivElement | null) => void;
  className: string;
  children: ReactNode;
}) {
  const { bounce, onAnimationEnd } = useSlabBounce(open);
  return (
    <div
      ref={cardRef}
      className={className + (bounce ? ' slab-bounce' : '')}
      onAnimationEnd={onAnimationEnd}
    >
      {children}
    </div>
  );
}

/** W-2 is the common case, so it carries the primary weight. */
function AddButtons({ onAdd }: { onAdd: (type: Stream['type']) => void }) {
  return (
    <div className="stream-add__row">
      <button className="filled-button" type="button" onClick={() => onAdd('w2')}>
        <PlusIcon size={20} /> W-2
      </button>
      <button className="tonal-button" type="button" onClick={() => onAdd('ten99')}>
        <PlusIcon size={20} /> 1099
      </button>
    </div>
  );
}
