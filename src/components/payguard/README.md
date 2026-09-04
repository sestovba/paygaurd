<!-- Written from the layout audit of 2026-09-03. The feature table is
     generated from the code, not from memory: see task-layout-audit in
     review/review-notes.json for the method and the scoring. -->

<!-- registry: order="7" group="Typing income in" — the heading this layout sits under in the
     layout switcher and the review console. Read by vite.layouts-plugin.ts,
     which builds that list from these files so neither has a copy to keep. -->

# PayGuard

**Cards you edit in place, with a bar to switch sections.**

## What it is for

**Desktop editing.** Cards you change in place, and the editor Work Record borrows.

| | |
|---|---|
| **Mobile** | ✗ afterthought |
| **Desktop** | ★ built for it |

> "desktop first mobile afterthought"
> — the owner, on importance rather than rank

The mirror of Work Record: same family, opposite viewport.

**Importance is not the score.** The points table below measures *breadth* —
how many features this layout carries. It is useful for spotting gaps and
useless for deciding what matters. A layout can be last on points and be the
heart of the product; `pocket` is exactly that.

## What it contributes to a crossbreed

**The editor.**

Owner: *"desktop first, mobile afterthought"* — and the desktop half is the
strong half. `PayGuardJobEditor` is the editor `workrecord` already borrows,
which makes it the most proven shared component in the product.

| Take | Leave |
|---|---|
| **The job editor.** Two layouts use it; it survived contact with both. | The **mobile treatment**, by the owner's own account an afterthought. |
| Its desktop editing model — the surface where real data entry actually happens. | Desktop editing with bank-or-paystub amounts and mileage taken off self-employment totals — shared with `ledger`. |

> The eight layouts are **feature discovery**, not eight drafts competing. The
> next layout is built new from a spec that names the traits it takes — see
> `CLAUDE.md § Crossbreeding, not transforming`. Run `npm run layouts` for the
> trait matrix, or `npm run layouts -- payguard <other>` to compare two.

## Owner's verdict

> "payguard is ok but brittle, its better on desktop. Can be wordy and some
> issues on mobile in other layout views."

## Where it sits

**Phase 2 — recording.**

## Score

| | |
|---|---|
| Points | 89 / 129 |
| Primary features | 5 / 8 |
| Size | 2,140 lines TSX + **2,453 lines CSS** |
| Value per 1k lines | 19.4 — second worst |

The CSS is larger than the TSX. That is the brittleness the owner feels.

## What it has that others do not

- A job editor good enough that **Work Record borrows it** rather than
  writing one.
- A chart, and the `pg-*` token system that Work Record also renders inside.

## Known gaps

Same cousins as Ledger — both now wired:

- **Mileage comes off** on self-employment totals (`mileageDeduction`).
- **Net → before-tax** on wage ledgers via shared `PayAmount`.

Hours-capacity answers remain out of scope on this layout for that pass.

## Files

`TrackerPayGuard.tsx` · `PayGuardAnalysis.tsx` · `PayGuardChart.tsx` ·
`PayGuardJobEditor.tsx` · `PayGuardPrimitives.tsx` · `PayGuardShell.tsx` ·
`src/styles/payguard.css`

## Rules

- The chart draws **one** limit line, from the `limit` prop. It used to draw
  both, labelled `SGA $1,690` and `TWP $1,210`.
- Work Record renders inside `.pg-payguard`. Changing a `--pg-*` token changes
  two layouts.
