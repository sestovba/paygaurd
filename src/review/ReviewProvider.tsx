import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Crosshair, Eye, EyeOff, ImagePlus, MessageSquarePlus, X } from 'lucide-react';
import { anchorId, describeElement, elementPath, insideOf, labelFor, widerThan } from './anchor';
import { actionable, notesToMarkdown } from './markdown';
import { fetchRemote, loadLocal, mergeNotes, pushRemote, saveLocal, uploadShot } from './store';
import type { NoteState, ReviewAnchor, ReviewLayoutId, ReviewNote, ReviewNotes } from './types';
import {
  DECISIONS, STATE_BLURB, STATE_NAME, TAGS, TAG_NAME,
  canMove, closedByClaude, hasAsk, progressOf, stateOf, tagsOf
} from './state';
import type { Tag } from './state';
import { applyHiddenAttributes, isHidden } from './hidden';
import {
  elementForNote, flashElement, isReviewUi, nearestVisible, openPage, showPeek
} from './locate';
import { ReviewContext } from './context';
import type { ReviewContextValue, ReviewMode, SuggestedTarget } from './context';
import { ReviewDock } from './ReviewDock';
import '../styles/review.css';

/** The console is a workshop tool: dev server or localhost only, never in a
 *  build someone else is using. */
const ENABLED = import.meta.env.DEV
  || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const PANEL_KEY = 'pg-review-open-v2';
const READ_KEY = 'pg-review-read-v1';

type ReadMarks = Record<string, string>;

interface Composer {
  id: string;
  label: string;
  anchor: ReviewAnchor;
  text: string;
  tags: Tag[];
  /** Repo-relative paths of the screenshots hung on this draft. */
  shots: string[];
  /** Where the thing being talked about was on screen when the composer
   *  opened, so the card can get out of its way. */
  over?: { top: number; left: number; width: number; height: number };
  /** True when this element already had a note — the composer is editing it
   *  rather than starting one. */
  existing: boolean;
}

/** Anything with a caret in it. Every command here is a single letter, so a
 *  field that has focus has to own every key it is sent — otherwise typing
 *  the word "cut" into a note arms three commands on the way past. */
function isTyping(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.isContentEditable) return true;
  if (/^(input|textarea|select)$/i.test(node.tagName)) return true;
  return Boolean(node.closest('[data-review-composer]'));
}

function loadRead(): ReadMarks {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? '{}') as ReadMarks;
  } catch {
    return {};
  }
}

/** Unread, and the last word on it is mine. Worth saying louder than the
 *  rest: it is the half of the conversation that arrives while the app is
 *  shut, written straight into the file.
 *
 *  Closed notes are excluded, and that is not a detail. Read marks live in
 *  one browser's localStorage, so a fresh profile has none — and counting
 *  every answered-and-settled note as news put "182 new" on the tab before
 *  anything had happened. A badge that is always lit says nothing. */
function isReply(note: ReviewNote, read: ReadMarks): boolean {
  if (stateOf(note) === 'closed') return false;
  const last = note.thread?.[note.thread.length - 1];
  return last?.from === 'claude' && (read[note.id] ?? '') < note.updatedAt;
}

export function ReviewProvider({
  layout,
  onNavigate,
  children
}: {
  layout: ReviewLayoutId;
  onNavigate?: (anchor: ReviewAnchor) => void;
  children: ReactNode;
}) {
  if (!ENABLED) return <>{children}</>;
  return <ReviewConsole layout={layout} onNavigate={onNavigate}>{children}</ReviewConsole>;
}

/**
 * Three surfaces, and they are the three things the console is for.
 *
 *   The pointer   Hover, select, say. No chrome — this is 90% of the use and
 *                 it should never need the rail open.
 *   The list      One column of notes, grouped by whose move it is.
 *   The handoff   The Markdown report, which is what I actually read.
 *
 * What used to be here was a 3,900-line component holding 44 pieces of state:
 * four modes, five lanes, four verdicts, eight derived verbs, four edge
 * shelves, a drag-and-drop placement model, a screenshot uploader, an A/B
 * switcher, bulk row selection, a walkthrough, per-panel folds and a
 * three-edge dock. Measured against 222 real notes, most of it had never been
 * used once. What is left is what the notes say the tool is.
 */
function ReviewConsole({
  layout,
  onNavigate,
  children
}: {
  layout: ReviewLayoutId;
  onNavigate?: (anchor: ReviewAnchor) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => localStorage.getItem(PANEL_KEY) === '1');
  const [mode, setMode] = useState<ReviewMode>('off');
  const [notes, setNotes] = useState<ReviewNotes>(loadLocal);
  const [read, setRead] = useState<ReadMarks>(loadRead);

  /* The pointer. `hovered` follows the cursor; `picked` is what a click
     froze; `trail` remembers the way back down after widening, so `[` and `]`
     are a pair rather than a one-way trip. */
  const [hovered, setHovered] = useState<Element | null>(null);
  const [picked, setPicked] = useState<Element | null>(null);
  const [, setTrail] = useState<Element[]>([]);

  const [composer, setComposer] = useState<Composer | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'warn' | 'info' } | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [, setTick] = useState(0); // scroll/resize nudge so the overlay follows

  const notesRef = useRef<ReviewNotes>(notes);
  const pickedRef = useRef<Element | null>(null);
  const history = useRef<ReviewNotes[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const suggested = useRef<Record<string, { label: string; reason: string }>>({});
  const composerRef = useRef<HTMLTextAreaElement>(null);
  /** The draft as it stands, so the uploader can read its id without being
   *  rebuilt on every character typed into the box. */
  const composerRef2 = useRef<Composer | null>(null);
  const loaded = useRef(false);

  notesRef.current = notes;
  pickedRef.current = picked;
  composerRef2.current = composer;

  const say = useCallback((text: string, tone: 'good' | 'warn' | 'info' = 'good') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Notes in, notes out                                              */
  /* ---------------------------------------------------------------- */

  /** Every write goes through here so undo is free and the file stays in
   *  step. One path in, one path out. */
  const changeNotes = useCallback((next: (current: ReviewNotes) => ReviewNotes) => {
    setNotes((current) => {
      const updated = next(current);
      if (updated === current) return current;
      history.current = [...history.current.slice(-24), current];
      setUndoDepth(history.current.length);
      return updated;
    });
  }, []);

  const undo = useCallback(() => {
    const previous = history.current.pop();
    setUndoDepth(history.current.length);
    if (!previous) return;
    setNotes(previous);
    say('Undone', 'info');
  }, [say]);

  // The repo file is the shared copy; localStorage is what survives the dev
  // server being off. Merge on load so a reply written into the file from a
  // code pass arrives without clobbering anything taken since.
  useEffect(() => {
    let alive = true;
    fetchRemote().then((remote) => {
      if (!alive) return;
      if (remote) setNotes((current) => mergeNotes(current, remote));
      loaded.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    saveLocal(notes);
    // Until the file has been read once, pushing would post a browser's copy
    // over a fuller one — which is exactly how notes went missing before.
    if (!loaded.current) return;
    const timer = window.setTimeout(() => { void pushRemote(notes); }, 400);
    return () => window.clearTimeout(timer);
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(read));
    } catch { /* private mode */ }
  }, [read]);

  useEffect(() => {
    localStorage.setItem(PANEL_KEY, open ? '1' : '0');
  }, [open]);

  /* ---------------------------------------------------------------- */
  /* Hiding                                                           */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    applyHiddenAttributes(notes, layout, mode === 'pick', peek);
    return () => applyHiddenAttributes({}, layout, false);
  }, [notes, layout, mode, peek]);

  const setHiddenById = useCallback((
    target: SuggestedTarget,
    hidden: boolean,
    el: Element | null
  ) => {
    changeNotes((current) => {
      const existing = current[target.id];
      // Switching it back on when nothing else was ever said leaves an empty
      // note behind, and an empty note is a row asking you to do nothing.
      if (!hidden && existing && !hasAsk(existing) && !existing.thread?.length) {
        const next = { ...current };
        delete next[target.id];
        return next;
      }
      const now = new Date().toISOString();
      return {
        ...current,
        [target.id]: {
          ...existing,
          id: target.id,
          kind: existing?.kind ?? 'delete',
          origin: existing?.origin ?? 'suggested',
          label: target.label,
          reason: target.reason || existing?.reason,
          status: existing?.status ?? 'yours',
          hidden: hidden || undefined,
          anchor: existing?.anchor ?? (el ? describeElement(el, layout) : { layout }),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        }
      };
    });
    say(hidden ? `Hidden · ${target.label}` : `Back on the page · ${target.label}`, 'info');
  }, [changeNotes, layout, say]);

  /* ---------------------------------------------------------------- */
  /* The pointer                                                      */
  /* ---------------------------------------------------------------- */

  const startComposer = useCallback((el: Element, opts?: { id?: string; reason?: string; label?: string }) => {
    const anchor = describeElement(el, layout);
    const id = opts?.id ?? anchorId(anchor);
    const existing = notesRef.current[id];
    setComposer({
      id,
      label: opts?.label ?? existing?.label ?? labelFor(el),
      anchor: existing?.anchor ?? anchor,
      text: existing?.comment ?? '',
      tags: existing ? tagsOf(existing) : [],
      shots: existing?.shots ?? [],
      over: (() => {
        const box = el.getBoundingClientRect();
        return { top: box.top, left: box.left, width: box.width, height: box.height };
      })(),
      existing: Boolean(existing)
    });
    if (opts?.reason && !existing) {
      suggested.current[id] = { label: opts.label ?? labelFor(el), reason: opts.reason };
    }
    window.setTimeout(() => composerRef.current?.focus(), 30);
  }, [layout]);

  /** Send images to the dev server and hang the paths on the draft. Anything
   *  that fails to upload is reported rather than silently dropped: a
   *  screenshot you think you attached and did not is worse than none. */
  const attachShots = useCallback(async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    const id = composerRef2.current?.id ?? `shot-${Date.now().toString(36)}`;
    const saved: string[] = [];
    for (const file of images) {
      const path = await uploadShot(id, file);
      if (path) saved.push(path);
    }
    if (!saved.length) { say('Could not save that image — is the dev server running?', 'warn'); return; }
    setComposer((current) => (current ? { ...current, shots: [...current.shots, ...saved] } : current));
    say(saved.length === 1 ? 'Screenshot attached' : `${saved.length} screenshots attached`, 'good');
  }, [say]);

  const commentOn = useCallback((
    label: string,
    el: Element | null,
    opts?: { id?: string; reason?: string }
  ) => {
    if (!el) return;
    startComposer(el, { ...opts, label });
  }, [startComposer]);

  // Hover tracking, only while pointing. The overlay follows the cursor and
  // the page underneath keeps working — nothing is captured, so a mode left
  // on by accident is a nuisance rather than a trap.
  useEffect(() => {
    if (mode !== 'pick') {
      setHovered(null);
      return;
    }
    const onMove = (event: PointerEvent) => {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el || isReviewUi(el)) return;
      setHovered(el);
    };
    const nudge = () => setTick((n) => n + 1);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', nudge, true);
    window.addEventListener('resize', nudge);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', nudge, true);
      window.removeEventListener('resize', nudge);
    };
  }, [mode]);

  // A click while pointing freezes the selection instead of pressing the
  // page. Capture phase, because the app's own handlers must not run.
  useEffect(() => {
    if (mode !== 'pick') return;
    const onClick = (event: MouseEvent) => {
      if (isReviewUi(event.target)) return;
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      setPicked(el);
      setTrail([]);
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [mode]);

  /* ---------------------------------------------------------------- */
  /* Filing a note                                                    */
  /* ---------------------------------------------------------------- */

  const fileNote = useCallback((draft: Composer, to: NoteState) => {
    const now = new Date().toISOString();
    changeNotes((current) => {
      const existing = current[draft.id];
      const proposal = suggested.current[draft.id];
      return {
        ...current,
        [draft.id]: {
          ...existing,
          id: draft.id,
          kind: existing?.kind ?? (proposal ? 'delete' : 'comment'),
          origin: existing?.origin ?? (proposal ? 'suggested' : 'user'),
          label: draft.label,
          reason: existing?.reason ?? proposal?.reason,
          comment: draft.text.trim() || undefined,
          tags: draft.tags.length ? draft.tags : undefined,
          shots: draft.shots.length ? draft.shots : undefined,
          hidden: existing?.hidden,
          thread: existing?.thread,
          status: to,
          anchor: draft.anchor,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        }
      };
    });
    setComposer(null);
    setPicked(null);
    say(to === 'sent' ? `Sent · ${draft.label}` : `Saved · ${draft.label}`, 'good');
  }, [changeNotes, say]);

  const setState = useCallback((note: ReviewNote, to: NoteState) => {
    const allowed = canMove(note, to);
    if (!allowed.ok) { say(allowed.why, 'warn'); return; }
    changeNotes((current) => ({
      ...current,
      [note.id]: { ...current[note.id], status: to, updatedAt: new Date().toISOString() }
    }));
  }, [changeNotes, say]);

  const dismiss = useCallback((note: ReviewNote) => {
    changeNotes((current) => {
      const next = { ...current };
      delete next[note.id];
      return next;
    });
    say(`Dismissed · ${note.label} — undo with U`, 'info');
  }, [changeNotes, say]);

  const reply = useCallback((note: ReviewNote, text: string) => {
    const body = text.trim();
    if (!body) return;
    changeNotes((current) => ({
      ...current,
      [note.id]: {
        ...current[note.id],
        thread: [...(current[note.id].thread ?? []), { from: 'you', text: body, at: new Date().toISOString() }],
        status: 'sent',
        updatedAt: new Date().toISOString()
      }
    }));
    setReplyDraft('');
    say('Sent', 'good');
  }, [changeNotes, say]);

  /* ---------------------------------------------------------------- */
  /* Locate                                                           */
  /* ---------------------------------------------------------------- */

  const pointAtNote = useCallback((note: ReviewNote) => {
    // A different layout is a different app. Put it back the way the note was
    // taken, then let the next render find the element.
    if (note.anchor.layout !== layout) {
      if (!onNavigate) { say(`Lives in the ${note.anchor.layout} layout`, 'info'); return; }
      onNavigate(note.anchor);
      window.setTimeout(() => {
        const el = elementForNote(note);
        if (el) flashElement(el);
      }, 320);
      return;
    }

    if (isHidden(note)) setPeek(note.id);

    const attempt = () => {
      const el = elementForNote(note);
      if (el) { flashElement(el); return true; }
      return false;
    };

    if (attempt()) return;

    // Not on this page of this layout: press the nav control the reader would
    // press, then look again.
    if (note.anchor.page && openPage(note.anchor.page)) {
      window.setTimeout(() => {
        if (!attempt()) {
          const near = nearestVisible(note);
          if (near) flashElement(near, 'near');
        }
      }, 280);
      return;
    }

    const near = nearestVisible(note);
    if (near) {
      flashElement(near, 'near');
      say('Not on screen — flashing what holds it', 'warn');
      return;
    }
    say('Cannot find it on this screen', 'warn');
  }, [layout, onNavigate, say]);

  useEffect(() => {
    showPeek(peek ? notesRef.current[peek] ?? null : null);
  }, [peek]);

  /* ---------------------------------------------------------------- */
  /* Keys                                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        if (composer) { setComposer(null); return; }
        if (picked) { setPicked(null); return; }
        if (mode !== 'off') { setMode('off'); return; }
        return;
      }

      if (event.key === 'd') { event.preventDefault(); setMode((m) => (m === 'pick' ? 'off' : 'pick')); return; }
      if (event.key === 'u') { event.preventDefault(); undo(); return; }

      if (event.key === 'c') {
        event.preventDefault();
        const el = pickedRef.current ?? hovered;
        if (el) startComposer(el);
        else { setMode('pick'); say('Point at something, then press C', 'info'); }
        return;
      }

      // Widening and narrowing the aim. `]` goes out to the first ancestor
      // that draws a bigger box, `[` comes back down the way it came — a card
      // here is four nested elements drawing the same rectangle, so stepping
      // one DOM node at a time changes nothing you can see.
      // `]` and `↑` both go out, `[` and `↓` both come back in. The arrows
      // are what a hand reaches for on a selection, and the brackets are what
      // the chip has always said, so both are bound to the same pair rather
      // than one replacing the other.
      const out = event.key === ']' || event.key === 'ArrowUp';
      const back = event.key === '[' || event.key === 'ArrowDown';
      if (out && pickedRef.current) {
        event.preventDefault();
        const wider = widerThan(pickedRef.current);
        if (wider) { setTrail((t) => [...t, pickedRef.current!]); setPicked(wider); }
        else say('Nothing wider to hold', 'info');
        return;
      }
      if (back && pickedRef.current) {
        event.preventDefault();
        setTrail((t) => {
          const previous = t[t.length - 1];
          if (previous) { setPicked(previous); return t.slice(0, -1); }
          const inside = insideOf(pickedRef.current!);
          if (inside) setPicked(inside);
          else say('Nothing inside this', 'info');
          return t;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composer, picked, hovered, mode, undo, startComposer, say]);

  /* ---------------------------------------------------------------- */
  /* Registration from wrapped sections                               */
  /* ---------------------------------------------------------------- */

  const register = useCallback((id: string, label: string, reason: string) => {
    suggested.current[id] = { label, reason };
    return () => { delete suggested.current[id]; };
  }, []);

  /* ---------------------------------------------------------------- */
  /* The list                                                         */
  /* ---------------------------------------------------------------- */

  /** Everything, always. There used to be a "this screen" tab in front of
   *  this and it was the default, so the console opened saying "You are
   *  clear" with 127 notes waiting on other layouts. A queue that hides its
   *  own backlog is worse than no queue. */
  const ordered = useMemo(() => (
    Object.values(notes)
      .filter(actionable)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  ), [notes]);

  const groups = useMemo(() => {
    const out: Record<NoteState, ReviewNote[]> = { yours: [], sent: [], closed: [] };
    for (const note of ordered) out[stateOf(note)].push(note);
    return out;
  }, [ordered]);

  const progress = useMemo(() => progressOf(ordered), [ordered]);
  const unreadReplies = ordered.filter((n) => isReply(n, read)).length;

  const copyForAi = useCallback(() => {
    void navigator.clipboard?.writeText(notesToMarkdown(notesRef.current));
    say('Copied the report', 'good');
  }, [say]);

  const markRead = useCallback((id: string) => {
    setRead((current) => ({ ...current, [id]: new Date().toISOString() }));
  }, []);

  /* ---------------------------------------------------------------- */

  const value: ReviewContextValue = useMemo(() => ({
    mode,
    notes,
    register,
    commentOn,
    focusId: peek,
    focusProposal: setPeek,
    isHidden: (id: string) => Boolean(notes[id]?.hidden),
    setHidden: setHiddenById
  }), [mode, notes, register, commentOn, peek, setHiddenById]);

  const aim = picked ?? hovered;

  return (
    <ReviewContext.Provider value={value}>
      {children}

      {/* The pointer's own overlay: an outline on what is under the cursor
          and a chip naming it. No panel, no toolbar — the whole point is that
          saying something costs one key. */}
      {mode === 'pick' && aim ? <AimOverlay el={aim} frozen={Boolean(picked)} /> : null}

      {composer ? (
        <ComposerCard
          draft={composer}
          textRef={composerRef}
          onChange={setComposer}
          onAttach={attachShots}
          onFile={fileNote}
          onClose={() => { setComposer(null); setPicked(null); }}
        />
      ) : null}

      <ReviewDock
        open={open}
        onToggle={() => setOpen((current) => !current)}
        mode={mode}
        onMode={setMode}
        onSay={() => {
          const el = pickedRef.current ?? hovered;
          if (el) startComposer(el);
          else { setMode('pick'); say('Point at something, then press C', 'info'); }
        }}
        counts={{ yours: progress.yours, sent: progress.sent, replies: unreadReplies }}
        undoDepth={undoDepth}
        onUndo={undo}
        onCopy={copyForAi}
      >
        <NoteList
          groups={groups}
          read={read}
          openRow={openRow}
          replyDraft={replyDraft}
          onReplyDraft={setReplyDraft}
          onOpenRow={(id) => { setOpenRow(id); if (id) markRead(id); }}
          onLocate={pointAtNote}
          onPeek={setPeek}
          onHide={(note) => setHiddenById(
            { id: note.id, label: note.label, reason: note.reason ?? '', layout: note.anchor.layout },
            !note.hidden,
            null
          )}
          onState={setState}
          onReply={reply}
          onDismiss={dismiss}
        />
      </ReviewDock>

      {toast ? <div className="review-toast" data-tone={toast.tone} data-review-ui>{toast.text}</div> : null}
    </ReviewContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* The pointer's overlay                                              */
/* ------------------------------------------------------------------ */

function AimOverlay({ el, frozen }: { el: Element; frozen: boolean }) {
  const box = el.getBoundingClientRect();
  const name = labelFor(el);
  const depth = elementPath(el).length;
  return (
    <div className="review-aim" data-frozen={frozen || undefined} data-review-ui aria-hidden="true">
      <span
        className="review-aim-box"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      />
      <span
        className="review-aim-chip"
        style={{ top: Math.max(4, box.top - 26), left: Math.max(4, box.left) }}
      >
        {name}
        {frozen ? <kbd>C to say · ↑↓ to resize</kbd> : <kbd>click to hold</kbd>}
        <span className="review-aim-depth">{depth}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The composer                                                       */
/* ------------------------------------------------------------------ */

/**
 * One field, four tags, two buttons.
 *
 * The tags are here rather than on the row because this is the moment the
 * reviewer knows what kind of change they want — asking later, from a list,
 * gets them guessed at or skipped.
 */
function ComposerCard({
  draft,
  textRef,
  onChange,
  onAttach,
  onFile,
  onClose
}: {
  draft: Composer;
  textRef: React.Ref<HTMLTextAreaElement>;
  onChange: (next: Composer) => void;
  onAttach: (files: File[]) => void;
  onFile: (draft: Composer, to: NoteState) => void;
  onClose: () => void;
}) {
  // A comment about a thing sits on top of the thing. Once it is in the way,
  // the reviewer needs it moved, not closed — so the header is a handle and
  // the card stays where it is put for the rest of the session.
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const card = useRef<HTMLFormElement>(null);
  /** Set the moment the reviewer moves the card themselves: after that it is
   *  their placement, and a new note is not a reason to take it back. */
  const dragged = useRef(false);
  const placedFor = useRef<string | null>(null);
  const shotInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  /* Opening on top of the thing you are talking about is the whole reason
     this card had to become draggable. So it places itself once, in whichever
     band — under the element or over it — has room for it, and only falls
     back to the middle when neither does. After that the reviewer's own drag
     wins and nothing moves it again. */
  useLayoutEffect(() => {
    if (dragged.current || placedFor.current === draft.id) return;
    placedFor.current = draft.id;
    const over = draft.over;
    const box = card.current?.getBoundingClientRect();
    if (!over || !box) return;
    const gap = 10;
    const below = window.innerHeight - (over.top + over.height);
    const above = over.top;
    const left = Math.min(Math.max(gap, over.left), window.innerWidth - box.width - gap);
    if (below >= box.height + gap * 2) { setAt({ x: left, y: over.top + over.height + gap }); return; }
    if (above >= box.height + gap * 2) { setAt({ x: left, y: over.top - box.height - gap }); return; }
    // Nothing above or below: go beside it, on the roomier side.
    const room = over.left > window.innerWidth - (over.left + over.width);
    const x = room ? over.left - box.width - gap : over.left + over.width + gap;
    if (x > gap && x + box.width < window.innerWidth - gap) {
      setAt({ x, y: Math.min(Math.max(gap, over.top), window.innerHeight - box.height - gap) });
    }
  }, [draft.id, draft.over]);

  const startDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const box = card.current?.getBoundingClientRect();
    if (!box) return;
    const dx = event.clientX - box.left;
    const dy = event.clientY - box.top;
    event.preventDefault();
    dragged.current = true;
    const move = (e: PointerEvent) => {
      // Kept whole on screen: a card dragged off the edge is a card you have
      // to reopen to get back.
      const x = Math.min(Math.max(4, e.clientX - dx), window.innerWidth - box.width - 4);
      const y = Math.min(Math.max(4, e.clientY - dy), window.innerHeight - 40);
      setAt({ x, y });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const takeFiles = (list: FileList | null) => {
    const files = [...(list ?? [])].filter((file) => file.type.startsWith('image/'));
    if (files.length) onAttach(files);
    return files.length > 0;
  };

  const ready = Boolean(draft.text.trim() || draft.tags.length || draft.shots.length);
  return (
    <form
      ref={card}
      className="review-composer"
      data-review-ui
      data-review-composer
      data-dragging={over || undefined}
      style={at ? { left: at.x, top: at.y, transform: 'none' } : undefined}
      onSubmit={(event) => { event.preventDefault(); if (ready) onFile(draft, 'sent'); }}
      // Drop anywhere on the card, not only in the text box: by the time the
      // file is over the window the reviewer is aiming at the note, not at a
      // particular field of it.
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setOver(false);
        takeFiles(event.dataTransfer.files);
      }}
    >
      <header onPointerDown={startDrag} title="Drag to move">
        <Crosshair className="size-3.5" />
        <strong>{draft.label}</strong>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Close without saving"
        >
          <X className="size-4" />
        </button>
      </header>

      {/* Paste a picture straight into the box you are already typing in: a
          screenshot is on the clipboard the instant you take one, and the
          whole reason for attaching it is that words were not working. */}
      <textarea
        ref={textRef}
        value={draft.text}
        placeholder="What should change about this? Paste or drop a screenshot too."
        onChange={(event) => onChange({ ...draft, text: event.target.value })}
        onPaste={(event) => {
          if (takeFiles(event.clipboardData.files)) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && ready) {
            event.preventDefault();
            onFile(draft, 'sent');
          }
          if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        }}
      />

      {draft.shots.length ? (
        <ul className="review-composer-shots" aria-label="Screenshots on this note">
          {draft.shots.map((path) => (
            <li key={path}>
              <img src={`/${path}`} alt="" />
              <button
                type="button"
                aria-label={`Remove ${path.split('/').pop()}`}
                title="Remove"
                onClick={() => onChange({ ...draft, shots: draft.shots.filter((p) => p !== path) })}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="review-composer-tags" role="group" aria-label="What kind of change">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            data-on={draft.tags.includes(tag) || undefined}
            aria-pressed={draft.tags.includes(tag)}
            onClick={() => onChange({
              ...draft,
              tags: draft.tags.includes(tag)
                ? draft.tags.filter((t) => t !== tag)
                : [...draft.tags, tag]
            })}
          >
            {TAG_NAME[tag]}
          </button>
        ))}
        {/* Paste and drop both work and neither announces itself, so there is
            one visible control to say the ability exists. */}
        <button
          type="button"
          className="review-composer-attach"
          title="Attach a screenshot"
          onClick={() => shotInput.current?.click()}
        >
          <ImagePlus className="size-3.5" /> Screenshot
        </button>
        <input
          ref={shotInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const list = event.currentTarget.files;
            takeFiles(list);
            event.currentTarget.value = '';
          }}
        />
      </div>

      <footer>
        <span className="review-composer-hint">{draft.anchor.source ?? draft.anchor.layout}</span>
        <button type="button" className="review-ghost" onClick={() => onFile(draft, 'yours')} disabled={!ready}>
          Keep for me
        </button>
        <button type="submit" className="review-primary" disabled={!ready}>
          Send <kbd>⌘↵</kbd>
        </button>
      </footer>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* The list                                                           */
/* ------------------------------------------------------------------ */

function NoteList({
  groups,
  read,
  openRow,
  replyDraft,
  onReplyDraft,
  onOpenRow,
  onLocate,
  onPeek,
  onHide,
  onState,
  onReply,
  onDismiss
}: {
  groups: Record<NoteState, ReviewNote[]>;
  read: ReadMarks;
  openRow: string | null;
  replyDraft: string;
  onReplyDraft: (text: string) => void;
  onOpenRow: (id: string | null) => void;
  onLocate: (note: ReviewNote) => void;
  onPeek: (id: string | null) => void;
  onHide: (note: ReviewNote) => void;
  onState: (note: ReviewNote, to: NoteState) => void;
  onReply: (note: ReviewNote, text: string) => void;
  onDismiss: (note: ReviewNote) => void;
}) {
  const order: NoteState[] = ['yours', 'sent', 'closed'];
  const total = order.reduce((sum, key) => sum + groups[key].length, 0);

  if (!total) {
    return (
      <p className="review-empty">
        Nothing yet. Press <kbd>D</kbd> to point at something, then <kbd>C</kbd> to say what is wrong with it.
      </p>
    );
  }

  return (
    <div className="review-list">
      {order.map((state) => {
        const rows = groups[state];
        if (!rows.length) return null;
        return (
          <section key={state} className="review-group" data-state={state}>
            <h3>
              <span>{STATE_NAME[state]}</span>
              <em>{STATE_BLURB[state]}</em>
              <span className="review-group-count">{rows.length}</span>
            </h3>
            {rows.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                unreadReply={isReply(note, read)}
                open={openRow === note.id}
                replyDraft={replyDraft}
                onReplyDraft={onReplyDraft}
                onOpen={() => onOpenRow(openRow === note.id ? null : note.id)}
                onLocate={() => onLocate(note)}
                onPeek={onPeek}
                onHide={() => onHide(note)}
                onState={(to) => onState(note, to)}
                onReply={(text) => onReply(note, text)}
                onDismiss={() => onDismiss(note)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/**
 * A row is the sentence, where it lives, and three things you can do to it.
 *
 * It used to carry seven: a checkbox for a bulk mode, a Do chip derived from
 * four overlapping taxonomies, an open button, a state pill, Locate, a
 * visibility switch and Dismiss — about 39 targets on screen to service four
 * notes. The chip is gone because the sentence says what is being asked
 * better than any of the eight verbs derived from it.
 */
function NoteRow({
  note,
  unreadReply,
  open,
  replyDraft,
  onReplyDraft,
  onOpen,
  onLocate,
  onPeek,
  onHide,
  onState,
  onReply,
  onDismiss
}: {
  note: ReviewNote;
  unreadReply: boolean;
  open: boolean;
  replyDraft: string;
  onReplyDraft: (text: string) => void;
  onOpen: () => void;
  onLocate: () => void;
  onPeek: (id: string | null) => void;
  onHide: () => void;
  onState: (to: NoteState) => void;
  onReply: (text: string) => void;
  onDismiss: () => void;
}) {
  const tags = tagsOf(note);
  const byClaude = closedByClaude(note);
  const state = stateOf(note);

  return (
    <article
      className="review-row"
      data-open={open || undefined}
      data-unread={unreadReply || undefined}
      onPointerEnter={() => onPeek(note.id)}
      onPointerLeave={() => onPeek(null)}
    >
      <button type="button" className="review-row-face" onClick={onOpen} aria-expanded={open}>
        <span className="review-row-name">
          {note.label}
          {note.hidden ? <EyeOff className="size-3 review-row-off" /> : null}
        </span>
        {note.comment ? <span className="review-row-said">{note.comment}</span> : null}
        <span className="review-row-where">
          <span className="review-row-src" title={note.anchor.source ?? note.anchor.layout}>
            {note.anchor.source ?? note.anchor.layout}
          </span>
          {tags.length ? <em>{tags.map((t) => TAG_NAME[t]).join(' · ')}</em> : null}
          {byClaude ? <em className="review-row-claude">closed by Claude</em> : null}
        </span>
      </button>

      <span className="review-row-acts" data-review-ui>
        <button type="button" onClick={onLocate} title="Locate — go to it and flash it" aria-label={`Locate ${note.label}`}>
          <Crosshair className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onHide}
          data-on={note.hidden || undefined}
          title={note.hidden ? 'Put it back on the page' : 'Hide it and see whether you miss it'}
          aria-label={note.hidden ? `Restore ${note.label}` : `Hide ${note.label}`}
        >
          {note.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button type="button" onClick={onOpen} title="Read it, and answer it" aria-label={`Reply to ${note.label}`}>
          <MessageSquarePlus className="size-3.5" />
        </button>
      </span>

      {open ? (
        <div className="review-row-body" data-review-composer>
          {note.reason ? <p className="review-row-reason">{note.reason}</p> : null}
          {(note.thread ?? []).map((entry, index) => (
            <p key={index} className="review-row-reply" data-from={entry.from}>
              <strong>{entry.from === 'claude' ? 'Claude' : 'You'}</strong>
              {entry.text}
            </p>
          ))}
          {note.shots?.length ? (
            <ul className="review-composer-shots" aria-label="Screenshots on this note">
              {note.shots.map((path) => (
                <li key={path}>
                  <a href={`/${path}`} target="_blank" rel="noreferrer"><img src={`/${path}`} alt="" /></a>
                </li>
              ))}
            </ul>
          ) : null}
          {note.anchor.sourceLine ? (
            <p className="review-row-line"><code>{note.anchor.sourceLine.slice(0, 140)}</code></p>
          ) : null}

          <textarea
            value={replyDraft}
            placeholder={`Reply about "${note.label}"…`}
            onChange={(event) => onReplyDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onReply(replyDraft);
              }
            }}
          />
          <div className="review-row-buttons">
            <button type="button" className="review-ghost" onClick={onDismiss}>Dismiss</button>
            {DECISIONS.filter((d) => d.to !== state && d.id !== 'say' && d.id !== 'hide').map((decision) => (
              <button
                key={decision.id}
                type="button"
                className="review-ghost"
                title={decision.hint}
                onClick={() => onState(decision.to)}
              >
                {decision.verb === 'Cut' ? 'Send as cut' : decision.verb}
              </button>
            ))}
            <button
              type="button"
              className="review-primary"
              disabled={!replyDraft.trim()}
              onClick={() => onReply(replyDraft)}
            >
              <Check className="size-3.5" /> Send
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
