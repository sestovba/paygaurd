// Shared by the browser ("Copy for AI") and the dev server, which writes the
// same text to review/REVIEW-NOTES.md so a code pass can just read the file.
//
// This file is the actual interface between the two people using the console:
// the reviewer points and types, and I read this. It is worth more care than
// the board is.

import type { ReviewNote, ReviewNotes } from './types';
import { claimCheck, stateOf, tagsOf } from './state';

/** Can this note's element be found at all?
 *
 *  A note with prose and no anchor reads like work and is not: there is no
 *  file, no text, no path — nothing to act on. These are worth seeing and
 *  fixing; they are not worth putting in a list of things to go and do. */
export function locatable(note: ReviewNote): boolean {
  return Boolean(note.anchor.source || note.anchor.text || note.anchor.domPath || note.anchor.reviewId);
}

/** A note that asks for something. A bare selection is a thing you pointed
 *  at, not a thing you asked for, and it does not reach the report. */
export function actionable(note: ReviewNote): boolean {
  return Boolean(note.comment || note.tags?.length || note.hidden);
}

function line(label: string, value?: string): string {
  return value ? `\n  - ${label}: ${value}` : '';
}

function headline(note: ReviewNote): string {
  const tags = tagsOf(note);
  if (tags.includes('cut')) return `CUT — ${note.label}`;
  if (tags.includes('move')) return `MOVE — ${note.label}`;
  if (note.hidden) return `HIDDEN — ${note.label}`;
  return `COMMENT — ${note.label}`;
}

function renderNote(note: ReviewNote): string {
  const state = stateOf(note);
  const box = state === 'closed' ? '[x]' : state === 'sent' ? '[!]' : '[ ]';
  const tags = tagsOf(note);

  return [
    `- ${box} **${headline(note)}**`,
    // What the reviewer wants changed comes first: it is the point of the note.
    note.comment ? `\n  - Needs: "${note.comment}"` : '',
    tags.length ? `\n  - Kind: ${tags.join(', ')}` : '',
    note.hidden ? '\n  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.' : '',
    /* `reason` is why the note exists at all, and only a delete note is
       proposing a cut. Saying "I propose cutting it" over a task or a comment
       claimed something the note never said. */
    note.reason
      ? `\n  - ${note.kind === 'delete' ? 'I propose cutting it' : 'Raised by'}: ${note.reason}`
      : '',
    line('Source', note.anchor.source),
    /* The line as it read when the note was taken. This is what tells a pass
       "moved" from "gone" when the number has drifted, so it is printed
       beside the number rather than left in the JSON. */
    note.anchor.sourceLine ? `\n  - Line was: \`${note.anchor.sourceLine.slice(0, 120)}\`` : '',
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
  const cuts = all.filter((n) => tagsOf(n).includes('cut')).length;

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
   * what is actually owed to it, with the anchor on the same line. Reading
   * two hundred notes to find fourteen was the tax on every pass.
   *
   * Sorted oldest first. It used to be sorted by a certainty × effort
   * estimate that only I ever wrote and only I ever read — I can sort my own
   * queue, and the reviewer should not be maintaining metadata for it. */
  const owed = all.filter((note) => stateOf(note) === 'sent');
  const suspect = all.filter((note) => claimCheck(note) === 'suspect');

  const digest = [
    '## Owed to Claude',
    '',
    owed.length
      ? 'Oldest first. The anchor is on the line under each one.'
      : 'Nothing is waiting on a code pass.',
    '',
    ...owed.map((note) => (
      `- **${note.label}** — ${note.anchor.layout}`
      + `${note.anchor.source ? `\n  \`${note.anchor.source}\`` : ''}`
      + `${note.comment ? `\n  > ${note.comment.replace(/\n+/g, ' ')}` : ''}`
    )),
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
    'One field says where a note has got to, and it is the same question as',
    'whose move it is:',
    '',
    '| `status` | Means |',
    '|---|---|',
    '| `yours` | The reviewer has it. |',
    '| `sent` | **Handed over. Your move.** |',
    '| `closed` | Settled. Nothing owed. |',
    '',
    '**`closed` is never taken at face value.** It is a claim about the code,',
    'and three things write this file — the app, a code pass, and a person with',
    'an editor. An item that still asks for a change and has no reply naming',
    'the file it changed reads back as `sent`, whatever the word says. The',
    'reverse also holds: a reply that *does* name a file closes the note, so',
    'work the reviewer asked for and received is not left in their queue.',
    '',
    '`tags` say what kind of change is wanted — cut, move, reword, redesign.',
    '`found` is set by the dev server on every write: whether the element is',
    'still in the source, checked against `anchor.sourceLine`, the line as it',
    'read when the note was taken. HIDDEN means switched off on the page to see',
    'whether it is missed — a question, not an answer, and the code is untouched.',
    '',
    'To answer a note, append to its `thread` array in review-notes.json with',
    '`{"from":"claude","text":"…","at":"<ISO>"}` — name the file you changed —',
    'and bump `updatedAt`. The app merges it in on the next load.',
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
    `${all.length} note(s) · ${owed.length} owed to Claude · ${cuts} cut(s)`,
    `Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    ...body
  ].join('\n');
}
