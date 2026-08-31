import { useEffect, useRef, useState } from 'react';
import {
  Archive, ChevronDown, GripVertical, MessageSquarePlus, Settings2, Trash2,
  Undo2, X
} from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import type { ReviewNote, ReviewNotes, TrayEdge, TraySettings } from './types';
import { TRAY_COLORS, TraySettingsPanel } from './TraySettings';

function sortItems(items: ReviewNote[], settings: TraySettings): ReviewNote[] {
  const sorted = [...items];
  switch (settings.sort ?? 'newest') {
    case 'oldest': return sorted.sort((a, b) => (a.stow?.at ?? '').localeCompare(b.stow?.at ?? ''));
    case 'label': return sorted.sort((a, b) => a.label.localeCompare(b.label));
    case 'flagged': return sorted.sort((a, b) => Number(Boolean(b.verdict)) - Number(Boolean(a.verdict)));
    default: return sorted.sort((a, b) => (b.stow?.at ?? '').localeCompare(a.stow?.at ?? ''));
  }
}

const EDGES: TrayEdge[] = ['left', 'right', 'top', 'bottom'];

/** The key that takes this shelf off the screen. Written on the shelf itself,
 *  because a hotkey nobody can see is a hotkey nobody uses. */
const HOTKEY: Record<TrayEdge, string> = { left: '←', right: '→', top: '↑', bottom: '↓' };

interface ChipActions {
  onGrabChip: (id: string, event: React.PointerEvent) => void;
  onFlag: (id: string) => void;
  onComment: (id: string) => void;
  onRestore: (id: string) => void;
}

/** One parked thing. Identical on a desk and in a hand, so what a chip does
 *  never has to be relearned between the two. */
function Chip({
  note, onGrabChip, onFlag, onComment, onRestore, focused
}: ChipActions & { note: ReviewNote; focused?: boolean }) {
  return (
    <div
      className="review-chip"
      data-flagged={note.verdict || undefined}
      data-focused={focused || undefined}
      data-review-chip-id={note.id}
      title={`${note.label} — drag back onto the page to restore`}
    >
      <span className="review-chip-main">
        <button
          type="button"
          className="review-chip-grip"
          onPointerDown={(event) => {
            event.stopPropagation();
            onGrabChip(note.id, event);
          }}
          aria-label={`Drag ${note.label}`}
          title="Drag this item"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="review-chip-label">{note.label}</span>
      </span>
      <span className="review-chip-tools">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRestore(note.id)}
          aria-label={`Restore ${note.label}`}
          title="Put it back where it came from"
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          data-on={note.verdict === 'approved' || undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onFlag(note.id)}
          aria-label={`Flag ${note.label} for deletion`}
          title="Flag for deletion — this is what the code pass reads"
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onComment(note.id)}
          aria-label={`Explain what should change about ${note.label}`}
          title="Say what needs to change"
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      </span>
      {note.comment ? <span className="review-chip-note">{note.comment}</span> : null}
    </div>
  );
}

/**
 * The four screen edges are storage. Dragging something in parks it; parking
 * says nothing about whether it should go — that is what the flags on each
 * chip are for.
 *
 * On a phone four edge shelves would leave a sliver of app between them, so
 * they stack into one accordion that drops down from the top. Same shelves,
 * same chips, same drop targets — only the furniture changes.
 */
export function EdgeTrays({
  notes,
  layout,
  activeEdge,
  dragging,
  hidden,
  shape,
  onGripDown,
  stackOpen,
  onStackToggle,
  onGrabChip,
  onFlag,
  onComment,
  onRestore,
  onCommentGroup,
  groupNote,
  traySettings,
  onTraySettings,
  focusedId,
  embedded = false
}: ChipActions & {
  notes: ReviewNotes;
  layout: LayoutMode;
  activeEdge: TrayEdge | null;
  /** True while something is being dragged out of the page, when all four
   *  sides need to be visible as targets. */
  dragging: boolean;
  /** Shelves the reviewer has taken off the screen for now. A drag overrides
   *  it — you cannot aim at a shelf that is not there. */
  hidden: TrayEdge[];
  /** 'edges' pins the four shelves to the sides of the screen. 'stack' folds
   *  them into one accordion — on a phone, and whenever the reviewer has
   *  clipped the shelves onto the toolbar to drag the two as one thing. */
  shape: 'edges' | 'stack';
  /** Present when the stack is a free-floating object of its own: it draws a
   *  grip and this starts the drag. Absent when it is clipped to the toolbar,
   *  which is dragged as one piece instead. */
  onGripDown?: (event: React.PointerEvent) => void;
  /** Owned by the toolbar, which carries the Stash button that opens it. */
  stackOpen: boolean;
  onStackToggle: () => void;
  /** One comment covering everything parked on that side. */
  onCommentGroup: (edge: TrayEdge) => void;
  groupNote: (edge: TrayEdge) => string | undefined;
  /** Name, colour and sort order for one side. */
  traySettings: (edge: TrayEdge) => TraySettings;
  onTraySettings: (edge: TrayEdge, patch: TraySettings) => void;
  /** Journal navigation can open and pulse one parked item. */
  focusedId?: string | null;
  /** Inside the compound rail, the rail itself is the panel header. */
  embedded?: boolean;
}) {
  const [settingsFor, setSettingsFor] = useState<TrayEdge | null>(null);
  const [openEdge, setOpenEdge] = useState<TrayEdge | null>(null);
  /** Live while a shelf is being slid along its edge; committed to the shelf's
   *  own settings on release so a drag is one undo step, not sixty. */
  const [sliding, setSliding] = useState<{ edge: TrayEdge; at: number } | null>(null);
  const slide = useRef<{ edge: TrayEdge; pointer: number; from: number } | null>(null);

  useEffect(() => {
    if (!slide.current) return;
    const onMove = (event: PointerEvent) => {
      const grip = slide.current;
      if (!grip) return;
      event.preventDefault();
      const along = grip.edge === 'left' || grip.edge === 'right' ? event.clientY : event.clientX;
      const limit = grip.edge === 'left' || grip.edge === 'right'
        ? window.innerHeight - 60
        : window.innerWidth - 120;
      setSliding({
        edge: grip.edge,
        at: Math.min(Math.max(8, grip.from + along - grip.pointer), limit)
      });
    };
    const onUp = () => {
      const grip = slide.current;
      slide.current = null;
      setSliding((current) => {
        if (grip && current) onTraySettings(grip.edge, { offset: Math.round(current.at) });
        return null;
      });
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [sliding, onTraySettings]);
  const parked = Object.values(notes).filter((note) => note.stow && note.anchor.layout === layout);
  const chipActions = { onGrabChip, onFlag, onComment, onRestore };
  const itemsIn = (edge: TrayEdge) => sortItems(
    parked.filter((note) => note.stow?.edge === edge),
    traySettings(edge)
  );

  useEffect(() => {
    if (!focusedId) return;
    const note = notes[focusedId];
    if (note?.stow?.edge) setOpenEdge(note.stow.edge);
  }, [focusedId, notes]);

  /** Gear and group-comment, shared by both shapes. */
  const shelfTools = (edge: TrayEdge, count: number) => (count ? (
    <>
      <button
        type="button"
        className="review-tray-comment"
        onClick={(event) => {
          event.stopPropagation();
          setSettingsFor(settingsFor === edge ? null : edge);
        }}
        aria-label={`Settings for the ${edge} stash`}
        title="Name, colour, sort"
      >
        <Settings2 className="size-3.5" />
      </button>
      <button
        type="button"
        className="review-tray-comment"
        onClick={(event) => { event.stopPropagation(); onCommentGroup(edge); }}
        aria-label={`Comment on everything in the ${edge} stash`}
        title={`One comment covering all ${count} item(s) on this shelf`}
      >
        <MessageSquarePlus className="size-3.5" />
      </button>
    </>
  ) : null);

  if (shape === 'stack') {
    const visible = EDGES.filter((edge) => dragging || !hidden.includes(edge));
    return (
      <div data-review-ui className="review-stack" data-open={stackOpen || dragging || undefined}>
        {/* One row: the grip, then the whole header as the open/close hit
            area. A separate grip band underneath made the panel read as two
            mismatched pieces stacked on each other. */}
        {!embedded ? <div className="review-stack-head">
          {onGripDown ? (
            <span
              className="review-stack-grip"
              onPointerDown={onGripDown}
              title="Drag the stashes around"
              aria-hidden="true"
            >
              <GripVertical className="size-3.5" />
            </span>
          ) : null}
          <button
            type="button"
            className="review-stack-toggle"
            onClick={onStackToggle}
            aria-expanded={stackOpen}
          >
            <Archive className="size-4" />
            <span>Stashes</span>
            <span className="review-tray-count">{parked.length}</span>
            <ChevronDown className="size-4 review-stack-caret" />
          </button>
        </div> : null}

        {embedded || stackOpen || dragging ? (
          <div className="review-stack-body">
            {visible.map((edge) => {
              const settings = traySettings(edge);
              const items = itemsIn(edge);
              const isOpen = openEdge === edge;
              return (
                <section
                  key={edge}
                  className="review-stack-shelf"
                  data-open={isOpen || undefined}
                  data-active={activeEdge === edge || undefined}
                  style={{ ['--tray-accent' as string]: settings.color ?? TRAY_COLORS[0] }}
                >
                  {/* The row is a container, not a button: the gear and the
                      group comment are buttons of their own and cannot be
                      nested inside another one. */}
                  <div className="review-stack-row">
                    <button
                      type="button"
                      className="review-stack-open"
                      onClick={() => setOpenEdge(isOpen ? null : edge)}
                      aria-expanded={isOpen}
                    >
                      <span className="review-stack-edge">{HOTKEY[edge]}</span>
                      <span className="review-stack-name">{settings.name || `${edge} shelf`}</span>
                      {items.length ? <span className="review-tray-count">{items.length}</span> : null}
                    </button>
                    {shelfTools(edge, items.length)}
                  </div>
                  {settingsFor === edge ? (
                    <TraySettingsPanel
                      edge={edge}
                      value={settings}
                      onChange={(patch) => onTraySettings(edge, patch)}
                      onClose={() => setSettingsFor(null)}
                    />
                  ) : null}
                  {isOpen ? (
                    <>
                      {groupNote(edge) ? <p className="review-tray-note">“{groupNote(edge)}”</p> : null}
                      <div className="review-tray-items">
                        {items.map((note) => (
                          <Chip
                            key={note.id}
                            note={note}
                            focused={note.id === focusedId}
                            {...chipActions}
                          />
                        ))}
                        {!items.length ? (
                          <span className="review-tray-empty"><X className="size-3" /> empty</span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {EDGES.map((edge) => {
        if (hidden.includes(edge) && !dragging) return null;
        const settings = traySettings(edge);
        const items = itemsIn(edge);
        // A stash is a handle when it is empty or when it has been clicked
        // shut; a drag opens every side up so there is somewhere to drop.
        const shut = settings.open === false;
        const collapsed = !dragging && (!items.length || shut);
        const side = edge === 'left' || edge === 'right';
        const offset = sliding?.edge === edge ? sliding.at : settings.offset;
        // A shelf sitting low has nowhere to grow downwards, so it grows up
        // from its handle instead of running off the bottom of the screen.
        const upwards = side && offset !== undefined && offset > window.innerHeight * 0.55;
        // Sized by its contents, capped by whatever room is left between the
        // handle and the edge of the window — it scrolls before it overflows.
        const place = offset === undefined
          ? undefined
          : side
            ? upwards
              ? {
                  top: 'auto' as const,
                  bottom: Math.max(8, window.innerHeight - offset - 34),
                  maxHeight: Math.max(120, offset + 34 - 16)
                }
              : {
                  top: offset,
                  bottom: 'auto' as const,
                  maxHeight: Math.max(120, window.innerHeight - offset - 16)
                }
            : { left: offset, right: 'auto' as const, width: 'max-content' as const };
        return (
          <div
            key={edge}
            data-review-ui
            className="review-tray"
            data-edge={edge}
            data-active={activeEdge === edge || undefined}
            data-filled={items.length > 0 || undefined}
            data-collapsed={collapsed || undefined}
            data-up={upwards || undefined}
            style={{ ['--tray-accent' as string]: settings.color ?? TRAY_COLORS[0], ...place }}
          >
            <span
              className="review-tray-name"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                const box = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                slide.current = {
                  edge,
                  pointer: side ? event.clientY : event.clientX,
                  from: side ? box.top : box.left
                };
                setSliding({ edge, at: side ? box.top : box.left });
              }}
              role={items.length ? 'button' : undefined}
              tabIndex={items.length ? 0 : undefined}
              title={items.length ? (shut ? 'Open this stash' : 'Close this stash') : undefined}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                if (items.length) onTraySettings(edge, { open: shut });
              }}
              onKeyDown={(event) => {
                if (items.length && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  onTraySettings(edge, { open: shut });
                }
              }}
            >
              {items.length
                ? (settings.name || `stash · ${edge}`)
                : collapsed ? (settings.name || 'stash') : 'drop to stash'}
              {items.length ? <span className="review-tray-count">{items.length}</span> : null}
              <kbd
                className="review-tray-key"
                title={`${HOTKEY[edge]} hides and shows this shelf (with nothing selected)`}
              >
                {HOTKEY[edge]}
              </kbd>
              {shelfTools(edge, items.length)}
            </span>
            {settingsFor === edge ? (
              <TraySettingsPanel
                edge={edge}
                value={settings}
                onChange={(patch) => onTraySettings(edge, patch)}
                onClose={() => setSettingsFor(null)}
              />
            ) : null}
            {!collapsed && groupNote(edge)
              ? <p className="review-tray-note">“{groupNote(edge)}”</p>
              : null}
            {collapsed ? null : (
              <div className="review-tray-items">
                {items.map((note) => (
                  <Chip
                    key={note.id}
                    note={note}
                    focused={note.id === focusedId}
                    {...chipActions}
                  />
                ))}
                {!items.length ? (
                  <span className="review-tray-empty"><X className="size-3" /> empty</span>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
