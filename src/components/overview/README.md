<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="8" group="The whole picture" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Overview

**Three shells, one layout.** `UiState.overviewShell` picks `scroll`, `pages`
or `workspace`; `detail.tsx` renders the six detail views all three share.
They were three separate layouts until the component matrix showed they drew
the same surfaces and differed only in chrome.

## What it is for

**Completeness.** The only layout carrying every primary feature.

| | |
|---|---|
| **Mobile** | · workable |
| **Desktop** | ★ side-by-side is superb |

> "well done"
> — the owner, on importance rather than rank

The shape to build on.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**One content set, three chromes.**

`overview` carries **all eight primaries** — the only layout that does — but
its transferable idea is structural: it *was* three layouts (classic, v2,
responsive) and was never three. `detail.tsx` renders the six detail views all
three share, and `UiState.overviewShell` picks the chrome.

| Take | Leave |
|---|---|
| **The shell/content split.** If two designs draw the same surfaces and differ in chrome, that is one layout with an option — and this is the working example. | The breadth itself. Eight-of-eight is a completeness score, not a design goal; a screen that shows everything asks the reader to choose what matters. |
| Its side-by-side desktop composition, which the owner rates highly. | |

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- overview <other>` to compare two.

## Owner's verdict

> "Overview specifically side-by-side version is superb, hard to criticize.
> Can be wordy and some issues on mobile in other layout views."

The side-by-side is the `workspace` shell. It is the highest praise given to
any surface in this project.

## Where it sits

**Phase 2 — recording**, and the only layout that also carries a piece of
Phase 1 (the hours answer). See "What the product is" in CLAUDE.md.

## Score

| | |
|---|---|
| Points | **121 / 129** — highest |
| Primary features | **8 / 8** — the only layout with all of them |
| Size | 1,482 lines of TSX, no stylesheet of its own |
| Value per 1k lines | 81.6 — second only to horizon |

## What it has that others do not

- **Answer in hours** (`capacityFor`) — shared only with `plan`, and it is the
  feature the product reframe puts first.
- **Every primary**, including the two most often missing: what actually
  counts after mileage, and the net → before-tax conversion.
- Notifications, the status quiz, the month scope picker, per-job editing.

## Known gaps

Nothing structural. Its problems are the ones the owner named: **wordiness**,
and the `scroll` / `pages` shells being weaker than `workspace` on a phone.
It has no chart and no individual-paycheck entry, and neither is missed.

## Files

`TrackerOverview.tsx` · `ScrollShell.tsx` · `PagesShell.tsx` ·
`WorkspaceShell.tsx` · `detail.tsx`

## Rules

- The three shells must keep drawing the same surfaces. The moment one grows a
  surface the others lack, it is a fourth layout and this file is wrong.
- It borrows almost everything from `src/components/*.tsx`, so a change to
  `SafetyHero`, `MonthGrid`, `StreamSheet` or `SettingsPanel` lands here first.
