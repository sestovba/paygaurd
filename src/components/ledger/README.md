<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="6" group="Typing income in" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# Ledger

**Every month as a row.** The fastest surface in the product for typing
amounts in.

Label placement (left vs above vs column headers): see [LABEL-LAYOUT.md](./LABEL-LAYOUT.md).

## What it is for

**Entry through tabs**, and the vibe. A year of rows, tab between them.

| | |
|---|---|
| **Mobile** | · workable |
| **Desktop** | ★ where it shines |

> "awesome because of tabs and design very cool vibe"
> — the owner, on importance rather than rank

The tabs are the feature the owner names, not the table.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**Entry through tabs, and the vibe.**

Owner: *"awesome because of tabs and design very cool vibe"*. It is the one
layout named for how it *feels* to use rather than what it shows.

| Take | Leave |
|---|---|
| **Tabs as the entry model** — the reason entry here is pleasant rather than a form. | Fast month-by-month entry with bank-or-paystub amounts and mileage taken off self-employment totals. |
| The desktop composition — this is where it shines. | |
| The atmosphere. It is a real trait and it is allowed to be a requirement. | |

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- ledger <other>` to compare two.

## Owner's verdict

> "Ledger is wordy and similar to payguard, good at entry"

## Where it sits

**Phase 2 — recording**, entry end.

## Score

| | |
|---|---|
| Points | 89 / 129 |
| Primary features | 5 / 8 |
| Size | 1,417 lines TSX + 1,009 lines CSS |
| Value per 1k lines | 36.7 |

## What it has that others do not

- **Entry speed.** A year of rows, tab between them, no sheet to open.
- A chart — shared only with PayGuard.
- Its own `Countable` column heading, the one place in the product that word
  survives, because the reviewer has read it there for months.

## Known gaps

Arithmetic primaries that used to be missing here are wired:

- **Mileage comes off** on self-employment entry (`mileageDeduction`), with a
  plain-language “miles take $X off” line next to the year totals.
- **Net → before-tax** on wage jobs via shared `PayAmount` (bank vs paystub).

Still open: hours-capacity answers on this layout (out of scope for that pass).

## Files

`TrackerLedger.tsx` · `LedgerAnalysis.tsx` · `LedgerChart.tsx` ·
`LedgerJobEditor.tsx` · `ledgerFormat.ts` · `src/styles/ledger.css`

## Rules

- The analysis table shows **one** limit column, against the limit in force.
  It used to show two — `vs SGA` and `vs TWP` side by side — which is the
  one-limit rule failing in public.
- **Worked** (hours) is omitted when no visible row has hours — same rule on
  the W-2 month entry grid, where empty hours used to be a column of dashes.
