// Shared by the browser ("Copy for AI") and the dev server, which writes the
// same text to review/REVIEW-NOTES.md so a code pass can just read the file.

import type { ReviewNote, ReviewNotes } from './types';
import { laneOf } from './types';
import { bucketOf, claimCheck, priorityOf, stateOf } from './state';

/** A note a code pass can act on.
 *
 *  Group and shelf notes used to qualify by carrying `members` or `stow`.
 *  Those were the edge trays' own bookkeeping — a shelf's name, colour and
 *  folded state — and with the trays retired they are records of a feature
 *  that no longer exists, asking for nothing. They stay in the file, and they
 *  stop reaching the report. */
/** Can this note's element be found at all?
 *
 *  A note with prose and no anchor reads like work and is not: there is no
 *  file, no text, no path — nothing to act on. "right tray · 2 items" carried
 *  a real sentence about year-level summaries and pointed at a layout, which
 *  is not a place. These are worth seeing and fixing; they are not worth
 *  putting in a list of things to go and do. */
export function locatable(note: ReviewNote): boolean {
  return Boolean(note.anchor.source || note.anchor.text || note.anchor.domPath || note.anchor.reviewId);
}

export function actionable(note: ReviewNote): boolean {
  return Boolean(
    note.verdict || note.comment || note.tags?.length
    || note.placement || note.hidden || note.shots?.length
    || note.kind === 'choice'
  );
}

function line(label: string, value?: string): string {
  return value ? `\n  - ${label}: ${value}` : '';
}

function headline(note: ReviewNote): string {
  if (note.members) return `GROUP — ${note.tray?.name ?? note.label}`;
  if (note.kind === 'choice') return `PICKED "${note.choice}" — ${note.label}`;
  if (note.verdict === 'approved') return `REMOVE — ${note.label}`;
  if (note.verdict === 'unsure') return `UNSURE — ${note.label}`;
  if (note.verdict === 'rejected') return `DISMISSED (not doing this) — ${note.label}`;
  if (note.placement) return `MOVE — ${note.label}`;
  if (note.stow) return `ARCHIVED — ${note.label}`;
  if (note.hidden) return `HIDDEN — ${note.label}`;
  return `COMMENT — ${note.label}`;
}

function renderNote(note: ReviewNote): string {
  const lane = laneOf(note);
  const box = lane === 'done' ? '[x]'
    : lane === 'second' ? '[~]'
      : lane === 'parked' ? '[-]'
        : lane === 'commented' ? '[!]' : '[ ]';
  const move = note.placement
    ? `place it ${note.placement.position} ${note.placement.anchorLabel ?? note.placement.anchor}`
      + `${note.placement.applied ? ' (the running app already shows it there)' : ' (not satisfiable at runtime — needs a code change)'}`
    : undefined;

  return [
    `- ${box} **${headline(note)}**`,
    // What the reviewer wants changed comes first: it is the point of the note.
    note.comment ? `\n  - Needs: "${note.comment}"` : '',
    note.tags?.length ? `\n  - Kind: ${note.tags.join(', ')}` : '',
    line('Move', move),
    note.members ? `\n  - Applies to: ${note.members.join(' · ')}` : '',
    note.tray?.name ? `\n  - Stash named "${note.tray.name}"` : '',
    note.stow ? `\n  - Archived on the ${note.stow.edge} shelf (off the page in the app, still in the code)` : '',
    note.hidden ? '\n  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.' : '',
    note.reason
      ? `\n  - I propose cutting it${note.certainty ? ` (${note.certainty})` : ''}: ${note.reason}`
      : '',
    note.effort ? `\n  - Effort: ${note.effort}` : '',
    // Listed as plain repo paths so a code pass can open them directly.
    note.shots?.length ? `\n  - Screenshots: ${note.shots.join(', ')}` : '',
    note.options ? `\n  - Alternatives shown: ${note.options.join(', ')}` : '',
    line('Source', note.anchor.source),
    line('Section id', note.anchor.reviewId),
    line('Component', note.anchor.components),
    line('Page', note.anchor.page),
    line('Text', note.anchor.text ? `"${note.anchor.text}"` : undefined),
    line('DOM', note.anchor.domPath),
    line('Origin', note.origin === 'suggested' ? 'AI suggestion, answered by the user' : 'picked by the user'),
    `\n  - Noted: ${note.createdAt.slice(0, 16).replace('T', ' ')}`,
    ...(note.thread ?? []).map((reply) => (
      `\n  - ${reply.from === 'claude' ? 'Claude' : 'Reviewer'} replied: "${reply.text}"`
    ))
  ].join('');
}

export function notesToMarkdown(notes: ReviewNotes): string {
  const everything = Object.values(notes).filter(actionable);
  /* Notes nobody can act on are kept out of the body and the digest, and
     named at the foot so nothing vanishes without a trace. */
  const unlocatable = everything.filter((note) => !locatable(note));
  const all = everything
    .filter(locatable)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const layouts = Array.from(new Set(all.map((n) => n.anchor.layout))).sort();
  const deletes = all.filter((n) => n.verdict === 'approved').length;
  const choices = all.filter((n) => n.kind === 'choice').length;
  const parked = all.filter((n) => n.stow).length;

  const body = layouts.map((layout) => {
    const mine = all.filter((n) => n.anchor.layout === layout);
    return [
      `## Layout: ${layout}`,
      '',
      ...mine.map(renderNote),
      ''
    ].join('\n');
  });

  /* What a code pass needs first, before any of the prose: the short list of
   * what is actually owed to it, in the order worth doing, with the anchor on
   * the same line. Reading fifty-three notes to find fourteen was the tax on
   * every pass; this is that answer, precomputed. */
  const owed = all
    .filter((note) => bucketOf(stateOf(note)) === 'withClaude')
    .sort((a, b) => priorityOf(a) - priorityOf(b));

  const suspect = all.filter((note) => claimCheck(note) === 'suspect');

  const digest = [
    '## Owed to Claude',
    '',
    owed.length
      ? 'Sorted by certainty then size — the checkable and contained first.'
      : 'Nothing is waiting on a code pass.',
    '',
    ...owed.map((note) => {
      const marks = [
        note.certainty ? `certainty: ${note.certainty}` : null,
        note.effort ? `effort: ${note.effort}` : null
      ].filter(Boolean).join(' · ');
      return `- **${note.label}** — ${note.anchor.layout}${marks ? ` (${marks})` : ''}`
        + `${note.anchor.source ? `\n  \`${note.anchor.source}\`` : ''}`
        + `${note.comment ? `\n  > ${note.comment.replace(/\n+/g, ' ')}` : ''}`;
    }),
    ''
  ];

  /* The check that would have caught the phantom backlog on its own: filed as
   * a finished cut, and the element is still in the source. */
  const flags = suspect.length ? [
    '## Claims that do not match the code',
    '',
    'Filed as a finished cut, but the element is still in the source. One of',
    'the two is wrong — check before trusting either.',
    '',
    ...suspect.map((note) => `- **${note.label}** — \`${note.anchor.source ?? note.anchor.layout}\``),
    ''
  ] : [];

  return [
    '# Review notes',
    '',
    'Written by the in-app review console (dev/localhost only — ⌘R, or the',
    'button bottom right). Do not hand-edit while the app is open: the app',
    'overwrites this file.',
    '',
    'One state per note, in `"status"`. Exactly one is true at a time, and each',
    'belongs to a group, which is whose move it is:',
    '',
    '| State | Group | Means |',
    '|---|---|---|',
    '| `new` | Yours | Not looked at yet. |',
    '| `needsYou` | Yours | Looked at; the reviewer says what they want. |',
    '| `trial` | Yours | Off the page while they see whether they miss it. |',
    '| `sent` | **Claude** | Handed over. Your move. |',
    '| `answered` | Yours | Claude replied; the reviewer confirms. |',
    '| `done` | Closed | Acted on in the code, and confirmed. |',
    '| `later` | Closed | Deliberately deferred. |',
    '| `wontDo` | Closed | Looked at and kept as it is. |',
    '',
    '**`done` is never taken at face value.** It is a claim about the code, and',
    'three things write this file. An item that still owes a change and has no',
    'reply saying it was made is read back as `sent`, whatever the word says.',
    '',
    '`certainty` (sure / likely / hunch) is how confident the proposal was.',
    '`effort` (small / medium / large) is how big the change is. `found` is set',
    'by the dev server on every write: whether the element is still in the',
    'source. HIDDEN means switched off on the page to see whether it is missed',
    '— a question, not an answer, and the code is untouched.',
    '',
    'To answer a note, append to its `thread` array in review-notes.json with',
    '`{"from":"claude","text":"…","at":"<ISO>"}`, set its `"status"`, and bump',
    '`updatedAt` — the app merges it in and shows the reply next to the comment.',
    '',
    ...digest,
    ...flags,
    ...(unlocatable.length ? [
      '## Not anchored to anything',
      '',
      'These carry a comment but nothing that identifies an element — no file,',
      'no text, no path. Nothing can be done with them until they point at',
      'something. Kept here so they are not lost.',
      '',
      ...unlocatable.map((note) => `- ${note.label}${note.comment ? ` — "${note.comment.replace(/\n+/g, ' ')}"` : ''}`),
      ''
    ] : []),
    `${all.length} note(s) · ${deletes} to delete · ${parked} parked · ${choices} A/B pick(s)`,
    `Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    ...body
  ].join('\n');
}
