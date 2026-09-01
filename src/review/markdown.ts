// Shared by the browser ("Copy for AI") and the dev server, which writes the
// same text to review/REVIEW-NOTES.md so a code pass can just read the file.

import type { ReviewNote, ReviewNotes } from './types';
import { laneOf } from './types';

/** A note a code pass can act on. The console also keeps housekeeping notes —
 *  a stash's name, colour and folded state — and those are settings, not
 *  findings, so they never reach the report. */
export function actionable(note: ReviewNote): boolean {
  return Boolean(
    note.verdict || note.comment || note.tags?.length
    || note.placement || note.members || note.stow || note.hidden
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
  if (note.verdict === 'rejected') return `KEEP (my suggestion rejected) — ${note.label}`;
  if (note.placement) return `MOVE — ${note.label}`;
  if (note.stow) return `STASHED — ${note.label}`;
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
    note.stow ? `\n  - Stashed on the ${note.stow.edge} shelf (off the page in the app, still in the code)` : '',
    note.hidden ? '\n  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.' : '',
    note.reason ? `\n  - I proposed cutting it because: ${note.reason}` : '',
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
  const all = Object.values(notes)
    .filter(actionable)
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

  return [
    '# Review notes',
    '',
    'Written by the in-app review console (dev/localhost only — ⌘R, or the',
    'button bottom right). Do not hand-edit while the app is open: the app',
    'overwrites this file. Every note sits in a lane, and either side can',
    'move it: `"status"` in review-notes.json is `"open"` (to do, `[ ]`),',
    '`"commented"` (`[!]` — the reviewer has said what they want and it is',
    'your move), `"second"` (`[~]` — worth another look), `"done"` (`[x]`',
    '— acted on) or `"parked"` (`[-]` — deliberately not now).',
    '',
    'STASHED means carried onto a shelf in the app; the code is untouched and',
    'it can be dragged back. HIDDEN means switched off with the eye — also',
    'untouched code, and a question ("is the screen better without this?")',
    'rather than an answer. REMOVE/KEEP/MOVE are the decisions to act on.',
    'A `Kind:` line carries the reviewer\'s own tags (cut, reword, spacing…) —',
    'the prose says what to change, the tags say what sort of change it is.',
    'The console\'s own housekeeping — a stash\'s name, colour or folded state —',
    'is deliberately not in here; every entry below is something to act on.',
    '',
    'To answer a note, append to its `thread` array in review-notes.json with',
    '`{"from":"claude","text":"…","at":"<ISO>"}` and bump that note\'s',
    '`updatedAt` — the app merges it in and shows the reply next to the comment.',
    '',
    `${all.length} note(s) · ${deletes} to delete · ${parked} parked · ${choices} A/B pick(s)`,
    `Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    ...body
  ].join('\n');
}
