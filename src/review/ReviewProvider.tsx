import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Crosshair, Eye, EyeOff, MessageSquarePlus, X } from 'lucide-react';
import type { LayoutMode } from '../state/storage';
import { anchorId, describeElement, elementPath, insideOf, labelFor, widerThan } from './anchor';
import { actionable, notesToMarkdown } from './markdown';
import { fetchRemote, loadLocal, mergeNotes, pushRemote, saveLocal } from './store';
import type { NoteState, ReviewAnchor, ReviewNote, ReviewNotes } from './types';
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
  layout: LayoutMode;
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
  layout: LayoutMode;
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
  const loaded = useRef(false);

  notesRef.current = notes;
  pickedRef.current = picked;

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
      existing: Boolean(existing)
    });
    if (opts?.reason && !existing) {
      suggested.current[id] = { label: opts.label ?? labelFor(el), reason: opts.reason };
    }
    window.setTimeout(() => composerRef.current?.focus(), 30);
  }, [layout]);

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

      if (event.key === 'l') { event.preventDefault(); setMode((m) => (m === 'pick' ? 'off' : 'pick')); return; }
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
      if (event.key === ']' && pickedRef.current) {
        event.preventDefault();
        const wider = widerThan(pickedRef.current);
        if (wider) { setTrail((t) => [...t, pickedRef.current!]); setPicked(wider); }
        return;
      }
      if (event.key === '[' && pickedRef.current) {
        event.preventDefault();
        setTrail((t) => {
          const back = t[t.length - 1];
          if (back) { setPicked(back); return t.slice(0, -1); }
          const inside = insideOf(pickedRef.current!);
          if (inside) setPicked(inside);
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
        {frozen ? <kbd>C to say · [ ] to resize</kbd> : <kbd>click to hold</kbd>}
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
  onFile,
  onClose
}: {
  draft: Composer;
  textRef: React.Ref<HTMLTextAreaElement>;
  onChange: (next: Composer) => void;
  onFile: (draft: Composer, to: NoteState) => void;
  onClose: () => void;
}) {
  const ready = Boolean(draft.text.trim() || draft.tags.length);
  return (
    <form
      className="review-composer"
      data-review-ui
      data-review-composer
      onSubmit={(event) => { event.preventDefault(); if (ready) onFile(draft, 'sent'); }}
    >
      <header>
        <Crosshair className="size-3.5" />
        <strong>{draft.label}</strong>
        <button type="button" onClick={onClose} aria-label="Close without saving">
          <X className="size-4" />
        </button>
      </header>

      <textarea
        ref={textRef}
        value={draft.text}
        placeholder="What should change about this?"
        onChange={(event) => onChange({ ...draft, text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && ready) {
            event.preventDefault();
            onFile(draft, 'sent');
          }
          if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        }}
      />

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
        Nothing yet. Press <kbd>L</kbd> to point at something, then <kbd>C</kbd> to say what is wrong with it.
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
          {note.anchor.source ?? note.anchor.layout}
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
