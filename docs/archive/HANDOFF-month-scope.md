# Handoff — month scope dropdown (unfinished)

You are picking up mid-task in `the repo (see CLAUDE.md — it is NOT at this path any more)`. Read
`CLAUDE.md` and `docs/WORKING-WITH-SERGEY.md` first. Nothing is committed.

## What Sergey asked for

> "one thing I would like to say about Month or calendar theres sometimes when
> its one item, we need to think about grouping themes that are built for one
> month at a time and those that are designed for multi months entry from the
> start, I think applying focus mode to a theme like that makes it feel like
> it's incomplete, I propose a dropdown on the layout for the theme Show
> remaining, this month+ the rest of the year items, show current this month+
> previous only (sorted correctly) and show all just the whole year and show
> this month only show one month, looks wrong on any such theme like ledger and
> others, you pick the one that focus mode selects by default but i think it
> should not be one month only."

He also said "please work on open review items" — **none of the queue in
`review/REVIEW-NOTES.md` § Owed to Claude has been touched.** All of it is
still owed.

## What is already done (code complete, `npm run typecheck` passes)

A new `monthScope` axis that replaces **both** `focusMode`'s effect on month
lists **and** `hideFuture` (which was the same axis with two of the four
positions).

- `src/domain/months.ts` — `MonthScope` = `'month' | 'sofar' | 'ahead' | 'year'`,
  `MonthShape` = `'single' | 'many'`, plus `MONTH_SCOPES`, `anchorMonth`,
  `scopedMonths`, `defaultScope`, `resolveScope`. `listedMonths` and
  `displayMonths` are **deleted** — one engine now.
  - `sofar` = anchor then backwards; `ahead` = anchor then forwards (and the
    whole year, ascending, when the year on screen is not this year — a
    finished year has no "rest"); `year` = anchor, back, then forward.
  - `defaultScope(focus, shape)`: focus off → `'year'`; focus on → `'month'`
    for `single`, `'sofar'` for `many`. **That is the answer to "you pick the
    one that focus mode selects by default".**
  - `resolveScope` ignores a chosen scope for `single` layouts (plan, pocket),
    so the ledger's dropdown cannot break them.
- `src/state/storage.ts` — `UiState.monthScope?: MonthScope` replaces
  `hideFuture`. `loadUi` carries a saved `hideFuture: false` over to `'year'`.
- `useMonthScope(shape)` → `{ scope, months, setScope }`, added to **both**
  providers: `src/state/TrackerProvider.tsx` and
  `src/components/calc20/state.tsx`. calc20's shim has `monthScope` in all
  four required places.
- `src/components/MonthScopePicker.tsx` (new, shared) — a native `<select>`,
  skinnable per layout. Labels in `MONTH_SCOPE_LABEL`:
  This month / So far this year / Rest of the year / All year.
- Wired in: **ledger** (header, `.lg-scope`), **payguard** (header,
  `.pg-field pg-field-sm`), **workrecord** (Monthly history slab `action`),
  **calc20** (the "Months" `Section` `action`, `.stream-panel-edit`), shared
  **MonthGrid** (classic / v2 / responsive) *and* its `MonthUpClose` branch.
  **horizon** follows the scope but has no picker (its runway is forward-only,
  so three of four positions would mean the same thing).
- Attention strips (ledger, payguard, workrecord) and `PaycheckRadar` use
  `scope === 'month' ? 'month' : 'ahead'` — they are about months ahead.
- Settings: toggling focus mode also clears `monthScope` (SettingsPanel and
  calc20 SettingsSheet) so the switch never looks dead. Copy updated in
  `settingsModel.ts` and the calc20 button.
- CSS added: `.lg-scope` (ledger.css), `.pg-calc20 .stream-panel-edit select`
  (calc20.css), `.pg-field-sm` (payguard.css).
- Copy forced by the change: MonthGrid `<h2>` "Every month this year" →
  "Months"; TrackerV2 caption "Full-year history" → "History". Both were false
  for three of the four positions.
- `CLAUDE.md` updated: the focus-mode bullet and the `months.ts` table row.

## Verified in the running app

calc20 (desktop **and** 375px) all four positions; ledger all four (1 card /
9 / 4 / 12 rows, chart hidden only on `month`); payguard at `sofar`;
workrecord 1/9/4/12 with the field matching its sibling buttons; v2's
MonthGrid round-tripping into "This month" and back out. Also verified the
domain engine directly for 2025 / 2026 / 2027 via esbuild + node.

## What is left — do these

1. **Write the review notes. Nothing has been written yet.** This is the one
   hard requirement outstanding. Follow CLAUDE.md exactly: **stop the dev
   server first** (it is running on port 5199), and do not restart it
   afterwards — the browser pushes its in-memory copy back and wipes new
   notes. Re-read `review/REVIEW-NOTES.md` and `src/review/VOCABULARY.md`
   before writing: another session refactored `src/review/` *during* this work
   (`stow.ts` → `hidden.ts`, `ReviewTarget` lost its `certainty` prop, new
   `locate.ts` / `ReviewDock`), so the note schema may have moved. Notes to
   write:
   - `task-month-scope` — anchor.source `src/domain/months.ts`. Sergey's
     request above as the comment; a `thread` reply naming every file in the
     "already done" section, and stating the default choice (`sofar` on the
     year-shaped layouts, `month` on plan/pocket) so he can overrule it
     cheaply.
   - `task-calc20-color-mix` — `src/styles/calc20.css` near line 5014:
     `.pg-calc20 .year-select` sets its border and background with
     `color-mix()`, which CLAUDE.md rules out for the old-WebView target. Two
     declarations, precomputable. Found in passing; pre-existing.
   - `task-horizon-month-scope` — `src/components/horizon/HorizonRunway.tsx`:
     why horizon has no dropdown, and what it would need if Sergey wants one.
   - `task-monthsheet-whole-year` — `src/components/MonthSheet.tsx` near line
     201: the "Show every month of <year>" switch is still keyed to
     `focusMode`, so a sheet opened from a nine-month ledger still refuses the
     twelve-field grid. Left alone because MonthSheet is shared with plan and
     pocket.
2. **PayGuard header at 375px.** The picker used to be `hidden sm:inline-flex`
   and is now visible at every width (a phone is the target device, so it has
   to be reachable there). Check `.pg-topbar`'s row for overflow at 375px. If
   it overflows, move it to the `PayGuardAnalysis` card head — the same move
   already made for calc20, where the topbar had no room. `PayGuardAnalysis`
   takes `scope` as a prop; it would need `onScopeChange` too, or call
   `useMonthScope('many')` itself.
3. **Open `classic` and `responsive` (v3)** — they share `MonthGrid` with v2,
   which is verified, but neither has been looked at.
4. Note: the Browser pane went **hidden** partway through, so screenshots come
   back blank; verification since then has been DOM measurement via
   `javascript_tool`. Re-show the pane if you want to look at it.

## Watch out for

- Another Claude session has been editing `src/review/` concurrently. Do not
  touch that tree. If `npm run typecheck` reports errors only under
  `src/review/`, they are not yours — wait rather than "fix" them.
- ~79 files were already modified before this work started; the diff is mixed.
