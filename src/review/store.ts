// Notes live in localStorage first (so nothing is lost when the dev server is
// off) and are mirrored to review/review-notes.json through a dev-only Vite
// endpoint, which is the copy an AI pass actually reads.

import type { ReviewNotes } from './types';

const STORAGE_KEY = 'pg-review-notes-v1';
const ENDPOINT = '/__review/notes';
const SHOT_ENDPOINT = '/__review/shot';

export function loadLocal(): ReviewNotes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReviewNotes) : {};
  } catch {
    return {};
  }
}

export function saveLocal(notes: ReviewNotes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Private mode; the session still works from memory.
  }
}

/** Newest write wins per note, so notes taken in another browser or restored
 *  from the repo file merge instead of clobbering each other. */
export function mergeNotes(a: ReviewNotes, b: ReviewNotes): ReviewNotes {
  const merged: ReviewNotes = { ...a };
  for (const [id, note] of Object.entries(b)) {
    const mine = merged[id];
    if (!mine || note.updatedAt > mine.updatedAt) merged[id] = note;
  }
  return merged;
}

export async function fetchRemote(): Promise<ReviewNotes | null> {
  try {
    const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as ReviewNotes;
  } catch {
    return null;
  }
}

export async function pushRemote(notes: ReviewNotes): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(notes)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send one pasted, dropped or picked image to the dev server and get back the
 * path to record on the note. Returns null when there is no dev server behind
 * the app — the console still works, it just cannot keep the picture.
 */
export async function uploadShot(id: string, file: Blob): Promise<string | null> {
  const type = file.type || 'image/png';
  if (!type.startsWith('image/')) return null;
  const ext = type.split('/')[1]?.split('+')[0] ?? 'png';
  try {
    const res = await fetch(`${SHOT_ENDPOINT}?id=${encodeURIComponent(id)}&ext=${encodeURIComponent(ext)}`, {
      method: 'POST',
      headers: { 'content-type': type },
      body: file
    });
    if (!res.ok) return null;
    const body = await res.json() as { ok?: boolean; path?: string };
    return body.ok && body.path ? body.path : null;
  } catch {
    return null;
  }
}
