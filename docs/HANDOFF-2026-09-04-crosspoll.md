# Handoff — 2026-09-04 · Cross-poll (easy + medium)

Local only. Not committed / not pushed. `main` is ahead of `origin`.

## Done this session (easy+medium+today)

- Extra-paycheck → Plan, Pocket
- PrecisionLine → Beautiful, Plan
- Hours → Horizon, Work Record, Ledger, PayGuard (after this pass)
- PayAmount + mileage → Ledger, PayGuard
- Default layout → beautiful (`DEFAULT_UI.layout` in `src/state/storage.ts`)

Sign-in / onboarding load `loadUi().layout` (or remember a saved choice) — no hardcoded first-run override to align.

## Can / should still do (small)

- Run `node scripts/layouts.mjs` after any primary-feature add; keep ledger + payguard at 8/8 primaries
- Skim Beautiful / Plan for any remaining missing primary that is a one-line import + render (scanner will name it)
- Confirm new-user path lands on Beautiful once (clear UI storage / fresh profile)

## Cannot / should not do without Sergey deciding (bigger)

- Pocket mileage (fights subtractive design)
- Beautiful inline gig row (mileage+hours in one-number editor) — spec exists, not built
- Calc20 onto shared updateMonthEntry / kill UiState shim
- Retire or delete layouts
- Push/commit (not done; local ahead of origin)
- Full crossbreed polish pass on Beautiful only
