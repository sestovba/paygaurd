/*
 * What the element said when you commented, beside what it says now.
 *
 * Approving is a judgement about a change, and the card was asking for it
 * with the change nowhere on it: a note, a reply describing work, and the
 * reviewer's own memory of a screen they last looked at days ago. "I rely on
 * my memory" is not a workflow, it is the absence of one.
 *
 * The before was in the file the whole time. `anchor.text` is the element's
 * words at the moment the note was written — captured for grepping, but it is
 * equally a photograph. Read the element the same way now and the two lines
 * can be put side by side, with the words that moved marked, so approving is
 * something you look at rather than something you remember.
 *
 * Only the words. It cannot see colour, spacing or a control that moved, and
 * it says so rather than implying nothing happened.
 */

/** One run of words, and whether it survived. */
export interface Span {
  text: string;
  state: 'same' | 'gone' | 'new';
}

export interface ThenNow {
  then: Span[];
  now: Span[];
  /** The words are identical — whatever was changed, it was not the wording. */
  unchanged: boolean;
}

/**
 * Read an element the way `describeElement` read it, so the two strings are
 * comparable. Anything else — `textContent`, a different cap — invents
 * differences that are only two ways of reading the same page.
 */
export function textNow(el: HTMLElement | null): string | null {
  if (!el) return null;
  const text = el.innerText?.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 140) : null;
}

function words(line: string): string[] {
  return line.split(' ').filter(Boolean);
}

/** Runs of one state, so the render is a handful of spans rather than one
 *  per word — a line broken into thirty elements wraps badly and reads worse. */
function runs(parts: { word: string; state: Span['state'] }[]): Span[] {
  const out: Span[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (last && last.state === part.state) last.text += ` ${part.word}`;
    else out.push({ text: part.word, state: part.state });
  }
  return out;
}

/**
 * Longest common subsequence over words. Both lines are at most 140
 * characters — twenty-odd words — so the table is small enough that the
 * simple version is the right one.
 */
export function compare(before: string, after: string): ThenNow {
  const a = words(before);
  const b = words(after);

  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const thenParts: { word: string; state: Span['state'] }[] = [];
  const nowParts: { word: string; state: Span['state'] }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      thenParts.push({ word: a[i], state: 'same' });
      nowParts.push({ word: b[j], state: 'same' });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      thenParts.push({ word: a[i], state: 'gone' });
      i += 1;
    } else {
      nowParts.push({ word: b[j], state: 'new' });
      j += 1;
    }
  }
  while (i < a.length) { thenParts.push({ word: a[i], state: 'gone' }); i += 1; }
  while (j < b.length) { nowParts.push({ word: b[j], state: 'new' }); j += 1; }

  return {
    then: runs(thenParts),
    now: runs(nowParts),
    unchanged: before === after
  };
}
