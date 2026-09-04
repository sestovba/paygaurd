# Handoff: finishing the review-console rebuild

You are picking up an unfinished refactor in `the repo (see CLAUDE.md — it is NOT at this path any more)`.
Read `CLAUDE.md` and `docs/WORKING-WITH-SERGEY.md` first — they are the law
here, and two rules from them govern this task:

- **Never call visual work done from a passing typecheck.** Open the app.
- **Do not hand-edit `review/review-notes.json` while the dev server is
  running**, and the browser holds a copy that it pushes back on the next
  run. Write notes last, after the final verification pass.

Nothing is committed. All the work below is in the working tree.

---

## What the refactor was

The in-app review console (`src/review/`) had accreted into a project-
management tool for a team that does not exist — there is one reviewer and
one AI, and the AI reads a file, never the UI. A usage audit against the 222
notes on file drove a cut list. The full written case is at
https://claude.ai/code/artifact/f1124b40-39fa-458b-b5b0-ba8a29243104

Evidence that drove it, measured from `review/review-notes.json`:

| Subsystem | Notes it served |
|---|---|
| Source anchor | 220 / 222 |
| Comment + one reply | 193 / 222 |
| Edge trays / stow / shelves | 2 |
| A/B variants | 1 |
| Drop-to-reposition (`ReviewPlacement`) | 0 |
| `second` lane | 0 |
| `anchor.sourceLine` | **0 — declared, read, never written** |

## What is already done (typecheck passes, verified in the running app)

- **One state model.** `NoteState = 'yours' | 'sent' | 'closed'` in
  `types.ts`; `state.ts` owns meaning, transitions, and the "closed is
  earned" rule. Deleted `ReviewLane` (5), `verdict` (4), the `DO` map,
  `actOf`, certainty (3) and effort (3). Legacy values migrate on read via
  `LEGACY` in `state.ts`. Tags trimmed to four with `remove`→`cut` aliasing
  in `tagsOf()`.
- **Deleted:** `stow.ts`, `ReviewVariants.tsx`, `DesktopDock.tsx`,
  `MobileDock.tsx`, `DockParts.tsx`, the screenshot uploader and its
  `/__review/shot` server endpoint.
- **New:** `hidden.ts` (hiding only), `locate.ts` (the pointing machinery,
  extracted intact — this is the best code in the tool, do not degrade it),
  `ReviewDock.tsx` (one right-hand rail).
- **`ReviewProvider.tsx` rewritten**: 4,275 lines / 44 `useState` → 931 / 12.
- **`review.css` rewritten**: 12,529 lines (with `:root` declared seven
  times) → 772.
- **Layout picker fixed.** It listed 6 of 10 layouts, missing Plan, Horizon,
  Pocket and Calc20. `ReviewDock.tsx` now imports `LAYOUT_GROUPS` from
  `src/components/LayoutSwitcher.tsx` so it cannot drift again. Verified.
- **`sourceLine` producer built** in `vite.review-plugin.ts`: `resolveSource`
  now returns the line's text with its number, and `withResolvedSources`
  freezes it on first capture only (`note.anchor.sourceLine ?? line`) so it
  stays evidence rather than re-confirming itself.

Verified live: `L` → hover outline → click to freeze → `C` → composer with
four tags and a live source anchor → Send → note filed, sent count 156→157.

---

## Task 1 — the open bug. Do this first.

**`found` counts move the wrong way and I could not explain it before the
session ended.** Two reads of the same file disagreed:

- after a live app session: `sourceLine` 66/233, `found: present` **79**
- after a dev-server restart:  `sourceLine` 68/233, `found: present` **38**

Current state: `sourceLine` 68/233, `found` = `{unknown: 195, present: 38}`,
160 notes still resolve to `(near line N, unverified)`.

`sourceLine` capture is real and working — it was 0 for all 222 notes before
— but **do not claim the integrity check works until `present` is stable
across restarts.** Suspects, in the order I would check them:

1. `locate()` in `vite.review-plugin.ts` requires `seen === 1` for a
   sourceLine to count as evidence. A line that appears 2+ times in the
   corpus falls through to the weaker text check. Verify the fall-through
   actually still returns `present` where it used to, and that the count
   loop (`corpus.indexOf` with a `seen < 4` bound) is correct.
2. The browser may POST a partial or stale set on first load before
   `fetchRemote()` merges. `ReviewProvider.tsx` guards this with
   `loaded.current`, but confirm the guard holds on a cold load with a
   populated `localStorage`.
3. I added a component-name resolution step to `resolveSource` (matches
   `function|const|class <Name>` from `anchor.components`) right before I was
   interrupted. It is **unverified** — it may be resolving notes onto
   declaration lines that are less distinctive than what they had, pushing
   them from `present` to `unknown`. Measure with and without it.

Method: stop the dev server, snapshot `review/review-notes.json`, start it,
load the app once, stop it, diff the `found` and `sourceLine` counts. Repeat.
A correct implementation is **stable across restarts** and only changes when
the source actually changes.

## Task 2 — stale docs contradict the code

`CLAUDE.md` and `src/review/VOCABULARY.md` still describe the old model —
eight states (`needsYou`, `trial`, `wontDo`…), `verdict`, `certainty`,
lanes, shelves. CLAUDE.md's own rule: *"If the code and that file disagree,
one is wrong. Fix it — never leave a contradictory rule standing."*

- `VOCABULARY.md` should shrink to roughly a page: three states, two modes
  (`off`/`pick`), four tags, four decisions, three row actions. Most of the
  current file is a changelog of word collisions already fixed — that it
  needed a dictionary at all was one of the findings.
- Update the CLAUDE.md sections on answering a review note and the status
  vocabulary.
- `review/REVIEW-NOTES.md` regenerates itself from `markdown.ts` and is
  already correct — do not hand-edit it.

## Task 3 — loose ends

- `src/review/thenNow.ts` (101 lines) is **orphaned** — nothing imports it
  since the rewrite. Confirm with a grep, then delete it.
- `review/shots/` is untracked and now unreachable; the uploader and its
  endpoint are gone. Decide with Sergey whether to delete the directory.
- Other layouts' stylesheets show as modified in `git status`
  (`calc20.css`, `plan.css`, `payguard.css`, …). Those changes are **not
  mine** — they predate this session. Do not fold them into a commit about
  the console without checking with Sergey first.
- Two notes present at `HEAD` (`el-1eggpcy`, `el-1oeaejz`) were already
  absent from the working tree before this session. Worth recovering from
  `git show HEAD:review/review-notes.json` if Sergey wants them.

## Task 4 — not started, lowest priority

`ReviewTarget.tsx` on-page controls went from six buttons to two (Hide,
Say). Confirm with Sergey that losing one-press "Cut" from the page is
right — the reasoning was that deciding belongs in one place, on the note
row where the state lives, but he has not seen it yet.

---

## How to finish

`npm run typecheck` must pass, and you must open the app and drive the loop
yourself — point, say, send, locate, hide, reply — before calling anything
done. Then, with the dev server **stopped**, answer the audit notes in
`review/review-notes.json` (`task-review-sourceline-producer`,
`audit-review-two-state-machines`, `task-review-delete-dead-subsystems`,
`audit-review-scope-tab-lies`, `task-review-strip-board-chrome`,
`task-review-dock-furniture`, `task-review-split-console`,
`audit-review-vocabulary-weight`) by appending
`{"from":"claude","text":"…","at":"<ISO>"}` to each `thread` — **name the
files you changed**, or the note reads back as `sent` whatever status you
set. Check `git diff review/review-notes.json` before committing.
