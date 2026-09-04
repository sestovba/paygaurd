# PayGuard UI Architecture

## Layer 1 — shared substrate

No layout personality.

- tokens
- Grid / GridColumn
- Surface
- StatusBadge
- LayoutRoot
- focus behavior
- spacing
- responsive geometry

## Layer 2 — shared product patterns

These should be extracted from the existing layouts, not reinvented.

- AppHeader / chrome
- MonthScope
- YearStepper
- Undo
- Settings
- Notifications
- JobSwitcher
- StatusSummary
- Attention / PaycheckRadar
- Analysis controls
- Empty / loading / error states

## Layer 3 — layout personalities

These remain visually distinctive.

- overview
- ledger
- payguard
- workrecord
- calc20
- horizon
- pocket
- charm
- plan
- beautiful

A layout personality may change presentation, density and composition,
but should not fork shared product behavior.

## Naming

Design-system classes use `pds-*`.

Existing product personalities keep their namespaces:

- `pg-*` PayGuard
- `lg-*` Ledger
- `pk-*` Pocket
- `pl-*` Plan
- etc.

This prevents design-system primitives from accidentally overriding a
layout's native CSS.
