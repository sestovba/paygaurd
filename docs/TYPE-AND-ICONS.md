# Type and icons

> **Why this file exists.** `palette.css` owns every colour and `metrics.css`
> owns every size and shape. Nothing owns the **letterforms** or the
> **glyphs** — so both grew by accident: five font families where three are
> used, and three parallel icon systems where one would do.
>
> This is the missing third token file's argument, plus the curated lists to
> pick from. Read PART 3 first if you only want the gaps.

Everything measured here was measured on **2026-09-04** against the source and
against a real font download. Numbers with a `※` were read off the running
browser, not estimated — per `THE-THREAD § measure, do not guess`.

---

# PART 1 · TYPE

## 1.1 What this audience makes non-negotiable

The usual font advice optimises for brand. This app's reader is on SSDI, often
partially sighted or not a confident reader, on a cheap Android, looking at
money. That turns four soft preferences into hard tests:

| Test | Why it is not taste |
|---|---|
| **Tabular figures** | `$1,000` above `$993` must align on the decimal or the reader compares two ragged shapes instead of two numbers. |
| **Unmistakable `0 O 1 l I`** | `$10` and `$1O` are different answers. A single-storey `l` next to a bare `1` is a benefits error. |
| **Readable at 14px** | `--t-text-sm` is the floor for prose and most of this UI sits on it. A font that only sings at 32px fails here. |
| **Small enough to arrive** | Metered data, 2G-ish. The whole type payload is a budget, not a preference. |

Anything that fails one of the four is out, however good it looks.

## 1.2 What we load today, measured

`index.html:10` requests five families from `fonts.googleapis.com`:

| Family | Latin woff2 ※ | Referenced by |
|---|---|---|
| Inter | 47.3 KB | `calc20.css`, `chrome.css` only |
| Inter Tight | 43.9 KB | `ledger.css`, `payguard.css`, `chrome.css` only |
| DM Sans | 36.1 KB | `--t-font-sans` — **every theme** |
| JetBrains Mono | 30.6 KB | `--t-font-mono` — **every theme** |
| Instrument Serif | 30.0 KB | `--t-font-display` — five of six themes |
| | **187.9 KB** + 34.7 KB CSS | |

Three findings from that table:

1. **91.2 KB — 49% of the payload — is two families that three stylesheets
   reference**, all three of them the un-migrated ones (`calc20`, `ledger`,
   `chrome`). The themed layouts never see Inter.
2. **The request is on the critical path twice.** A render-blocking stylesheet
   from `fonts.googleapis.com`, which then names files on `fonts.gstatic.com` —
   two DNS + TLS handshakes before the first font byte, on the connection least
   able to afford them. `display=swap` covers the text, not the stylesheet.
3. **`saveData` is never consulted**, although `CLAUDE.md § The device is the
   floor` names it as the mechanism for exactly this.

### The 29 declarations that do nothing ※

Google serves one variable file per family and declares it four times at
discrete weights — `400`, `500`, `600`, `700`. Measured widths of
`$1,000 left` at 100px in DM Sans:

```
400 → 491.5    600 → 514.0    700 → 523.4
500 → 501.5    650 → 523.4    750 → 523.4    800 → 523.4
```

`650`, `750` and `800` are the same pixels as `700`. The stylesheets contain
**11 × `font-weight: 650`** (`charm`, `calc20`), **7 × `750`** (`workrecord`,
`charm`) and **11 × `800`** (`horizon`, `payguard`, `pocket`, `plan`,
`chrome`). Every one of them renders at 700. Self-hosting the variable file
with `font-weight: 100 900` on one `@font-face` makes all 29 real — and costs
*less*, because it is one file instead of four declarations of one file.

## 1.3 The curated list

All SIL OFL or Apache 2.0: free for commercial use, **self-hostable**,
modifiable, subsettable, no attribution in the UI. Ordered by the job they do,
not by fashion.

### Tier 1 · Built for readers who struggle — the ones this audience earns

| Font | License | Why it is here |
|---|---|---|
| **Atkinson Hyperlegible Next** | OFL | Braille Institute, redrawn 2025: variable weight, 7 weights, 150+ languages. Every glyph pair that can be confused was deliberately pulled apart — `0/O`, `1/l/I`, `b/d`, `p/q`. **The strongest single answer to §1.1 tests 1–2 that exists for free.** |
| **Atkinson Hyperlegible Mono** | OFL | New in 2025. Same DNA, fixed advance. The correct mono for a money column read by a low-vision user. |
| **Lexend** | OFL | Seven *widths* on a variable axis; the classroom studies show real gains for slow readers, and the honest caveat is that the effect is per-reader, not universal. Take the width axis as a **setting**, not a default. |

### Tier 2 · Workhorse UI sans — numbers first

| Font | License | Why it is here |
|---|---|---|
| **Inter** | OFL | Still the correct default for data UI: tabular figures by default, an optical-size axis that opens tracking at small sizes, and `cv11`/`zero` for a slashed zero and single-storey `l`. |
| **Public Sans** | OFL | The US Web Design System face — drawn for government forms read by everybody, with no personality to get in the way. Ages extremely well at 14px. |
| **IBM Plex Sans** | OFL | Sans + Mono + Serif + Condensed in one designed family. If a product ever needs all four voices to agree, this is the cheapest way. |
| **Source Sans 3** | OFL | Adobe's quiet one. Vast language coverage, entirely unremarkable in the good way. |
| **Roboto Flex** | Apache 2.0 | One variable file, many axes — and Roboto is **already on the device** on Android, making it the only entry here whose fallback is the real thing rather than an approximation. |
| **Figtree** · **Manrope** · **Work Sans** | OFL | Warmer, rounder. Where a `calm` theme would go if it wanted its own voice. |
| **Geist** | OFL | Modern and tight. Beautiful; weaker on numeral disambiguation than Inter, so not for the money screens. |

### Tier 3 · Mono and numerals

| Font | License | Why it is here |
|---|---|---|
| **JetBrains Mono** | OFL | What we ship. Tall x-height, slashed zero, good at 12px. No reason to move. |
| **IBM Plex Mono** | OFL | The pair to Plex Sans. |
| **Recursive** | OFL | Sans *and* mono in one variable file, with a `CASL` casual axis. A whole type system for roughly one family's bytes. |
| **Fira Code / Fira Mono** | OFL | The classic. Ligatures off for UI. |

### Tier 4 · Display and voice

| Font | License | Why it is here |
|---|---|---|
| **Instrument Serif** | OFL | What we ship at 30 KB for both romans. Distinctive, cheap, and its job is five words at 36px. Keep. |
| **Fraunces** | OFL | Variable serif with `SOFT` and `WONK` axes — a display face that can be dialled from friendly to strange. |
| **Literata** · **Newsreader** | OFL | Reading serifs, if long-form ever appears. |
| **Bricolage Grotesque** · **Space Grotesk** | OFL | Variable display grotesques, if the voice ever goes sans. |

### Not recommended, and the reason

- **OpenDyslexic** — the weighted bottoms are widely believed to help and the
  evidence does not support it; the heavy baseline actively slows scanning of
  a column of figures. Atkinson does the same job with real research behind it.
- **Any font without tabular figures** on a money surface. This rules out most
  of the "best free fonts" lists wholesale.
- **Icon fonts as text** — see §2.4.

## 1.4 What to actually do here

Three changes, in value order. None is a taste change; each is measurable.

1. **Drop Inter and Inter Tight, or own the cost knowingly.** 91.2 KB for
   three stylesheets, all of them un-migrated. Migrating `calc20`, `ledger`
   and `chrome` to `--t-font-sans` deletes half the type payload and one
   inconsistency at the same time.
2. **Self-host, subset to latin, one variable file per family.** Removes two
   third-party origins from the critical path, and makes the 29 dead weight
   declarations in §1.2 real.
3. **Add Atkinson Hyperlegible Next as a type choice on `UiState`.** THE-THREAD
   says this audience includes readers who are "partially or fully blind". A
   reader who needs it turns it on; it costs nothing to anyone who does not.
   This is the highest-value single addition in this document.

And the floor rule from `CLAUDE.md` applies unchanged: **the fallback stack
must be complete on its own.** Every family here ships behind a real
`ui-sans-serif, system-ui` stack with `font-display: swap`, and
`navigator.connection.saveData` declines the download outright.

---

# PART 2 · ICONS

## 2.1 There are three icon systems, and nobody chose that

| System | Size | Where |
|---|---|---|
| **`lucide-react`** | 66 distinct icons | 38 files — the real set |
| **`calc20/Icons.tsx`** | 34 hand-drawn, 279 lines | 10 files in `calc20/` |
| **Text glyphs** | `›` `‹` `✕` `→` `−` | `horizon`, `payguard`, `HelpSpread`, others |

`calc20`'s set duplicates Lucide for at least 33 of its 34: `PlusIcon`,
`CloseIcon`, `ChevronDown/Right/Left`, `TrashIcon`, `BellIcon`, `LockIcon`,
`CopyIcon`, `PencilIcon`, `DownloadIcon`, `UploadIcon`, `PauseIcon`,
`CheckIcon`, `CloudIcon`, `WarningIcon` — all of these exist in the dependency
already installed. Only the view-mode glyphs (`PivotIcon`, `CarouselIcon`,
`MonthColumnsIcon`, `RoomyIcon`, `CompactIcon`, `HideFutureIcon`) are genuinely
ours, and those are the ones worth keeping.

## 2.2 Four ways to size an icon, and the tokens lose

`metrics.css:123` already defines the answer:

```css
--t-icon-sm: 1rem;    /* 16 */
--t-icon:    1.25rem; /* 20 */
--t-icon-lg: 1.5rem;  /* 24 */
```

The call sites use it almost never. Measured across `src/`:

- **`size={n}` props** — 13 distinct values: `11 12 13 14 15 16 17 18 19 20 22 26 30`. Only `16` and `20` land on a token; `size={17}` appears **16 times**.
- **Tailwind classes** — `size-3`, `size-3.5`, `size-4`, `size-5` on the same
  `<Zap>` in five different files.
- **`--t-icon-*`** — the tokens themselves.
- **Raw CSS** `width`/`height` in the layout stylesheets.

Stroke drifts the same way: `2`, `2.2`, `2.25`, `2.4`, `2.5`, `2.75` — six
weights for one icon set whose entire premise is a 2px stroke on a 24px grid.

## 2.3 Two names for one glyph

`TriangleAlert` (6 uses) and `AlertTriangle` (2) are the same drawing under
Lucide's old and new names. So are `CircleCheck` (1) and `CheckCircle2` (1).
A designer sees one icon; `grep` sees two; a rename touches half the sites.

And nothing anywhere says what a glyph **means**. `Zap` is imported in nine
files — for an extra paycheck month, in the notifications list, in onboarding,
in two job editors. That is probably one meaning, and it is nowhere written
down, so the tenth use will be a coin flip.

## 2.4 The curated list

All permissive, all self-hostable, all tree-shakable as SVG:

| Library | Icons | License | Grid | Take it when |
|---|---|---|---|---|
| **Lucide** | 1,500+ | ISC | 24 / 2px | **What we use.** The sane default: strict grid, real React package, no runtime. |
| **Tabler** | 5,900+ | MIT | 24 / 2px | Lucide is missing a glyph. Same grid and stroke, so it drops in *visually* — the only library that can be mixed with Lucide without it showing. |
| **Phosphor** | ~1,200 × 6 weights | MIT | 24 | We ever need a fill or duotone axis — six weights of the same drawing, which Lucide cannot do. |
| **Heroicons** | ~300 | MIT | 24 / 20 / 16 | Small icons matter. Three optical sizes **drawn separately** rather than scaled — the right answer to §2.2 that Lucide does not have. |
| **Material Symbols** | 3,000+ | Apache 2.0 | 24 variable | We want fill/weight/**grade**/optical-size on axes. Grade is genuinely useful for dark mode. But it is a *font* — needs the `@supports` floor and a fallback, so it fights §1.1 test 4. |
| **Remix Icon** | 3,000+ | Apache 2.0 | 24 | Outline + filled pairs are needed as a system. |
| **Radix Icons** | ~300 | MIT | 15 | Best-in-class at genuinely tiny sizes. |
| **Bootstrap Icons** | 2,000+ | MIT | 16 | Breadth, filled-first. |
| **Feather** | 280 | MIT | 24 / 2px | Never — Lucide is its maintained fork. |

**The recommendation is that we do not change library.** Lucide is already
here, already ISC, already on the grid, and the problem is not the drawings.
The problem is that there are three sets, four sizing channels, six strokes
and no meanings.

## 2.5 What to actually do here

1. **One registry, keyed by meaning, not by drawing.** `src/design-system/icons.ts`
   maps `paycheck`, `limit`, `overLimit`, `locked`, `close`, `back`, `delete`
   onto Lucide glyphs. Call sites import the meaning. Changing what a paycheck
   looks like then costs one line, and "which icon means over the limit" has
   an answer.
2. **Three sizes, from `--t-icon-*`, and nothing else.** Delete every
   `size={17}`.
3. **Stroke 2. Everywhere.** It is what the grid is drawn for.
4. **Retire `calc20/Icons.tsx`** down to the six view-mode glyphs that are
   genuinely ours, drawn on Lucide's 24/2 grid, and put them in the registry
   beside the rest.
5. **Collapse the aliases** — one name per glyph.
6. **Text glyphs are not icons.** `›` and `✕` inherit font metrics, change
   shape with every family, and are invisible to a screen reader as anything
   but punctuation. Replace with the registry.
7. **Ratchet it.** `npm run debt` already fails a build when hand-rolled
   controls or off-token sizes go up. An icon rule belongs in the same script:
   an off-token icon size, a second stroke width, or a 35th hand-drawn glyph
   should fail the same way.

---

# PART 3 · WHAT ELSE IS MISSING

The colour and shape layers are finished and guarded. Type is neither.

| Gap | Measured | Where it belongs |
|---|---|---|
| **No leading tokens** | 138 `line-height` declarations, **20 distinct values** | `metrics.css § 1` |
| **No tracking tokens** | 203 `letter-spacing` declarations, **46 distinct values** — `-0.055em` through `0.16em`, including near-duplicates like `-.02em` and `-0.02em` | `metrics.css § 1` |
| **`--t-weight-*` stops at 600** | `700` is the most-used weight in the app (**150 declarations**) and has no token; `650`, `750`, `800` have no token *and* no effect | `metrics.css § 1` |
| **No numeric token** | `font-variant-numeric: tabular-nums` repeated across **13 files**, plus one `font-feature-settings: "tnum"` doing the same job differently | `metrics.css § 1` |
| **Icon size tokens ignored** | 13 distinct `size={n}` values, only 2 on-token | §2.2 |
| **No guard** | `theme:check` fails a build on an unmapped colour or a missing shape. Nothing fails on a 47th letter-spacing or a 14th icon size. | `scripts/theme-check.mjs` or `design-debt.mjs` |

Leading and tracking are **shape**, and the argument of `metrics.css` is that
shape lives in one place. They are the two properties that most change how a
low-vision reader gets through a sentence, and they are the only two the token
system does not have an opinion about.

**The type ramp is also silent on line-height**, which means every one of the
seven steps is paired with whatever the call site happened to write. A ramp
that specifies size and not leading has specified half a ramp.

---

# 4 · Adding to this system

1. **A new family** → a `--t-font-*` in `metrics.css § 1`, then per-theme in
   § 2. Never a literal in a layout stylesheet.
2. **A new icon** → a meaning in the registry, then a Lucide glyph behind it.
   If Lucide has no glyph, Tabler — same grid, invisible seam.
3. **A new size, leading or tracking** → a token, or use the one that exists.
   The point of 46 letter-spacings is that nobody could find the right one.
4. **A change to any of it** → this file and the code in the same pass. If
   they disagree, one is wrong.
