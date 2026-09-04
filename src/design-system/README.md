# PayGuard design system

This directory is the public React API for PayGuard's existing shared UI
system. It does not own a second set of visual tokens.

## Foundation

The canonical CSS foundation lives in:

- `src/styles/palette.css` — semantic colour tokens
- `src/styles/metrics.css` — spacing, type, motion and shape
- `src/styles/controls.css` — buttons and fields
- `src/styles/chrome.css` — cross-layout chrome such as notices and toasts

## React primitives

Existing, production-tested primitives are exposed through this directory:

- `Button`
- `IconButton`
- `ButtonRow`
- `Sheet`
- `LayoutRoot`

Import from `src/design-system` when migrating or building shared product UI.

## Layout personalities

The ten application layouts keep their own visual personalities and
layout-specific CSS.

Shared behavior should move into reusable components. Layout identity should
not.

## Naming

Existing layout namespaces remain valid:

- `pg-*` PayGuard
- `lg-*` Ledger
- `pk-*` Pocket
- `pl-*` Plan
- `hz-*` Horizon
- layout-specific equivalents for the remaining modes

New shared component CSS should use `ui-*`.

`pds-*` is reserved for structural design-system hooks that have no layout
personality, such as `pds-layout-root`.
