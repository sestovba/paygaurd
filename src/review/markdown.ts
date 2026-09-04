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
  /* A reference point counts. A note filed against "Round down, always" has
     no element and is more actionable than most notes that have one: it names
     the rule, and the rule names the file. The check is "can this be found",
     not "is this a node". */
  return Boolean(
    note.anchor.doc
    || note.anchor.source || note.anchor.text || note.anchor.domPath || note.anchor.reviewId
  );
}

/** A note that asks for something. A bare selection is a thing you pointed
 *  at, not a thing you asked for, and it does not reach the report. */
export function actionable(note: ReviewNote): boolean {
  // A screenshot on its own counts: a picture of the thing that is wrong is
  // an ask, and it is the one the reviewer reaches for when words were the
  // part that was not working.
  return Boolean(note.comment || note.tags?.length || note.hidden || note.shots?.length);
}

function line(label: string, value?: string): string {
  return value ? `\n  - ${label}: ${value}` : '';
}

/** "CLAUDE.md › Who this is for" — the reference point, as one string. */
function refLabel(file: string, heading?: string): string {
  const name = file.split('/').pop() ?? file;
  const short = name === 'README.md' ? file.split('/').slice(-2).join('/') : name;
  return heading ? `${short} › ${heading}` : short;
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
    /* What the note is about, when that is not a node. Printed first among
       the anchor lines because for these notes it IS the anchor — and because
       a scope line is the difference between "fix this card" and "fix this
       everywhere", which is the whole reason a reader is holding it. */
    note.anchor.doc
      ? `\n  - About: ${note.anchor.scope === 'global' ? 'the whole product' : `the ${note.anchor.layout} layout`} — ${refLabel(note.anchor.doc.file, note.anchor.doc.heading)}${note.anchor.doc.line ? `:${note.anchor.doc.line}` : ''}`
      : '',
    note.anchor.doc && note.anchor.scope === 'global'
      ? `\n  - Seen on: ${note.anchor.layout} — where it was noticed, not what it is about`
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
    /* The width it was written at. "Taller in mobile" is not checkable
       without it — including by the person who wrote it. */
    note.anchor.viewport
      ? `\n  - Seen at: ${note.anchor.viewport.w}×${note.anchor.viewport.h} (${note.anchor.viewport.band})`
      : '',
    line('Origin', note.origin === 'suggested' ? 'AI suggestion, answered by the user' : 'picked by the user'),
    `\n  - Noted: ${note.createdAt.slice(0, 16).replace('T', ' ')}`,
    ...(note.thread ?? []).map((reply) => (
      `\n  - ${reply.from === 'claude' ? 'Claude' : 'Reviewer'} replied: "${reply.text}"`
    ))
  ].join('');
}


/* ------------------------------------------------------------------------ */
/* The same thing, asked again                                              */
/* ------------------------------------------------------------------------ */
/*
 * One instruction filed on five screens is one instruction, and the report
 * used to print it five times with nothing to say they were related.
 *
 * That is not a cosmetic problem. `WORKING-WITH-SERGEY.md` opens §2 with "a
 * comment is a direction, not a local edit" — treat one note as the general
 * case and carry it to the cousin layouts — and the measurable failure of
 * that rule is a reviewer re-typing the same sentence on the next screen
 * because the first one was fixed locally. It is measurable, so it is
 * measured here rather than left for someone to notice: "increase height by
 * 30%" and "taller iin mobile" are the same ask, and a pass that sees them
 * together fixes the rule instead of the button.
 *
 * Deliberately crude — shared words, not meaning. It is a prompt to look, and
 * the cost of a false pair is that two notes are printed side by side.
 */

const NOISE = new Set([
  'the', 'a', 'an', 'is', 'it', 'this', 'that', 'to', 'of', 'in', 'on', 'and',
  'or', 'be', 'we', 'i', 'should', 'can', 'do', 'for', 'with', 'at', 'not'
]);

function askWords(note: ReviewNote): string[] {
  const text = (note.comment ?? '').toLowerCase();
  return Array.from(new Set(
    text.replace(/[^a-z0-9%\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !NOISE.has(w))
  ));
}

/** Share of the smaller set's words that appear in the larger. */
function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const big = new Set(a.length > b.length ? a : b);
  const small = a.length > b.length ? b : a;
  return small.filter((word) => big.has(word)).length / small.length;
}

/** Groups of notes that ask the same thing on more than one layout. */
function repeats(notes: ReviewNote[]): ReviewNote[][] {
  const candidates = notes
    .filter((note) => askWords(note).length >= 2 && askWords(note).length <= 14)
    .map((note) => ({ note, words: askWords(note) }));

  const groups: { notes: ReviewNote[]; words: string[] }[] = [];
  for (const item of candidates) {
    const hit = groups.find((group) => overlap(group.words, item.words) >= 0.7);
    if (hit) hit.notes.push(item.note);
    else groups.push({ notes: [item.note], words: item.words });
  }

  /* Two notes on two different elements, not two layouts.
     Requiring two layouts was the obvious test and it was wrong: the clearest
     case in this file is "taller in mobile" filed four times on four controls
     of ONE layout, which says the height rule is wrong even more plainly than
     the cross-layout version does. What makes a repeat interesting is that
     the same sentence was aimed at more than one thing. */
  return groups
    .filter((group) => new Set(group.notes.map((n) => n.anchor.source ?? n.id)).size > 1)
    .map((group) => group.notes)
    .sort((a, b) => b.length - a.length);
}

export function notesToMarkdown(notes: ReviewNotes): string {
  const everything = Object.values(notes).filter(actionable);
  /* Notes nobody can act on are kept out of the body and the digest, and
     named at the foot so nothing vanishes without a trace. */
  const unlocatable = everything.filter((note) => !locatable(note));
  const all = everything
    .filter(locatable)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const cuts = all.filter((n) => tagsOf(n).includes('cut')).length;

  /* A note about the product does not belong under the layout it was noticed
     on. Filed there it reads as a note about that screen, gets fixed on that
     screen, and comes back on the next one — which is the failure the scope
     was added to end, so the report must not undo it. */
  const isGlobal = (note: ReviewNote) => note.anchor.scope === 'global';
  const everywhere = all.filter(isGlobal);
  const perLayout = all.filter((note) => !isGlobal(note));
  const layouts = Array.from(new Set(perLayout.map((n) => n.anchor.layout))).sort();

  const body = [
    ...(everywhere.length ? [[
      '## The whole product',
      '',
      'Not about one screen. Each is filed against the rule it is about, and',
      'the fix belongs wherever that rule reaches.',
      '',
      ...everywhere.map(renderNote),
      ''
    ].join('\n')] : []),
    ...layouts.map((layout) => {
      const mine = perLayout.filter((n) => n.anchor.layout === layout);
      return [
        `## Layout: ${layout}`,
        '',
        ...mine.map(renderNote),
        ''
      ].join('\n');
    })
  ];

  /* What a code pass needs first, before any of the prose: the short list of
   * what is actually owed to it, with the anchor on the same line. Reading
   * two hundred notes to find fourteen was the tax on every pass.
   *
   * Sorted oldest first. It used to be sorted by a certainty × effort
   * estimate that only I ever wrote and only I ever read — I can sort my own
   * queue, and the reviewer should not be maintaining metadata for it. */
  /*
   * Two queues, because they were one and it made the real one unreadable.
   *
   * 132 of 278 notes in this file were written by Claude — follow-ups noticed
   * mid-pass and set down so they would survive the session. Useful, and not
   * the reviewer's work. Mixed into one list they doubled the length of the
   * thing the reviewer opens to see what is waiting on them, and the reply
   * that closes one of mine is mine to write, not theirs.
   *
   * So: what the reviewer raised is the queue. What Claude raised is Claude's
   * backlog, listed separately and further down.
   */
  const isReviewers = (note: ReviewNote) => note.origin !== 'suggested';
  const open = all.filter((note) => stateOf(note) === 'sent');
  const owed = open.filter(isReviewers);
  const mine = open.filter((note) => !isReviewers(note));
  const suspect = all.filter((note) => claimCheck(note) === 'suspect');
  /* Only what is still owed: a repeat that has already been answered
     everywhere it was raised is history, not a queue of five. */
  const said = repeats(owed);

  const renderRow = (note: ReviewNote) => (
    `- **${note.label}** — ${note.anchor.layout}`
    + `${note.anchor.source ? `\n  \`${note.anchor.source}\`` : ''}`
    + `${note.comment ? `\n  > ${note.comment.replace(/\n+/g, ' ')}` : ''}`
  );

  const digest = [
    '## Owed to Claude',
    '',
    owed.length
      ? 'What **you** raised and Claude has not answered. Oldest first; the'
        + '\nanchor is on the line under each one.'
      : 'Nothing you raised is waiting on a code pass.',
    '',
    ...owed.map(renderRow),
    '',
    ...(said.length ? [
      '## Said more than once',
      '',
      'The same ask, aimed at more than one element — grouped by shared wording,',
      'so read each group before acting on any one of it. These are the notes',
      'where the fix is the rule rather than the element: see',
      '`docs/WORKING-WITH-SERGEY.md § A comment is a direction, not a local edit`.',
      'A note filed with the **Everywhere** scope never lands here, because it',
      'only had to be said once.',
      '',
      ...said.map((group) => [
        `- **${group.length}×** — ${Array.from(new Set(group.map((n) => n.anchor.layout))).join(', ')}`,
        ...group.map((note) => (
          `  - "${(note.comment ?? '').replace(/\n+/g, ' ')}"`
          + `${note.anchor.source ? `\n    \`${note.anchor.source}\`` : ''}`
          + `${note.anchor.viewport ? `\n    seen at ${note.anchor.viewport.w}px` : ''}`
        ))
      ].join('\n')),
      ''
    ] : []),
    ...(mine.length ? [
      "## Claude's own backlog",
      '',
      'Raised by Claude, not by you — follow-ups noticed while doing something',
      'else. Here so they are not lost, and so they stay out of the list above.',
      'Nothing here needs a reply from you.',
      '',
      ...mine.map(renderRow),
      ''
    ] : [])
  ];

  /*
   * The history. Asked for directly — "we should have review history log" —
   * and it is the other half of "when you complete a task it shouldn't stay":
   * a note that leaves the queue has to go somewhere visible, or closing it
   * looks like losing it.
   */
  const closed = all
    .filter((note) => stateOf(note) === 'closed')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  /* The first sentence that says something. Half the answers in this file
     open with "Done." or "Fixed in src/x.ts:" — true, and no use at all as
     the one line standing for the work in a history. Openers like that are
     stepped over so the summary is the sentence a person would want. */
  /* No `.` or `/` inside the opener, or it eats into a filename: "Fixed in
     src/theme.ts." matched through the path and left the summary starting
     "ts. applyTheme now…". */
  const OPENER = /^(?:done|fixed|removed|moved|added|changed)\b[^./:]{0,40}[.:]\s*/i;
  const summarise = (text: string) => {
    let flat = text.replace(/\s+/g, ' ').trim();
    const opener = OPENER.exec(flat);
    if (opener && flat.length > opener[0].length + 20) flat = flat.slice(opener[0].length);
    const stop = flat.search(/[.;]\s/);
    const line = stop > 30 && stop < 170 ? flat.slice(0, stop + 1) : flat.slice(0, 170);
    return line.trim() + (line.length < flat.length ? '…' : '');
  };

  const history = closed.length ? [
    '## History',
    '',
    `${closed.length} settled, newest first — what changed and when. Reopening one`,
    'is a single press in the console.',
    '',
    ...closed.slice(0, 60).map((note) => {
      const answer = [...(note.thread ?? [])].reverse().find((m) => m.from === 'claude');
      const when = (note.updatedAt ?? '').slice(0, 10);
      return `- \`${when}\` **${note.label}** — ${note.anchor.layout}`
        + `${answer ? `\n  ${summarise(answer.text)}` : ''}`;
    }),
    ...(closed.length > 60 ? [`- …and ${closed.length - 60} older.`] : []),
    ''
  ] : [];

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
    'Written by the in-app review console (dev/localhost only — ⌥R, or the',
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
    '**A finished note leaves the queue.** An item that asks for a change and',
    'has an answer on it is closed and moves to History, whoever typed the',
    'status. Only one with no answer at all reads back as `sent`.',
    '',
    'Closing used to also require the reply to spell a filename. That held 144',
    'of 193 finished notes open forever — almost all of them had a real answer',
    'that just did not happen to contain a path — so the rule was scoring',
    'prose, not completeness, and it is gone.',
    '',
    '`tags` say what kind of change is wanted — cut, move, reword, redesign.',
    '`found` is set by the dev server on every write: whether the element is',
    'still in the source, checked against `anchor.sourceLine`, the line as it',
    'read when the note was taken. HIDDEN means switched off on the page to see',
    'whether it is missed — a question, not an answer, and the code is untouched.',
    '',
    'To answer a note, append to its `thread` array in review-notes.json with',
    '`{"from":"claude","text":"…","at":"<ISO>"}` and bump `updatedAt`. The app',
    'merges it in on the next load. You never have to reply to close anything.',
    '',
    ...digest,
    ...flags,
    ...history,
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
    `${all.length} note(s) · ${owed.length} owed to Claude · ${mine.length} in Claude's backlog`
      + ` · ${closed.length} settled · ${cuts} cut(s)`,
    `Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    ...body
  ].join('\n');
}
