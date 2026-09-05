# Ledger label layout

How words sit next to numbers on this layout — **placement** first, then **type role**.
Pick the placement that matches the job; then pick the type role from the
loud→quiet scale already in `ledger.css`. Do not invent a third way to label
the same kind of thing.

---

## Type roles (loud → quiet)

Already tokenized. Use the role class; do not pick a raw `rem`.

| Role | Class / token | Voice | Use for |
|------|---------------|-------|---------|
| Figure | `.lg-type-figure` | mono, big | Countable money on analysis cards |
| Title | `.lg-type-title` / `.lg-header-title` | sans for names, mono for mid money | Page name, job name, year total |
| UI | `.lg-type-ui` / `.lg-section-toggle` | sans | Tabs, section toggles, empty-state heading |
| Body | `.lg-type-body` | mono | Table cells, help under a field, year stepper |
| **Label** | **`.lg-label`** | mono caps | Field names, column headers, strip titles |
| Caption | `.lg-type-caption` | mono | Legends, secondary meta, units in a row |
| Micro | `.lg-type-micro` | mono | Badges, axis pills, field suffixes (`miles`) |

Sans = names & chrome. Mono = numbers & dense UI. Same job → same family.

---

## Placement patterns (the varieties on this page)

### 1. Page identity — name in the chrome
**Where:** top bar (`SSDI Tracker`).
**Shape:** sans title, no `.lg-label`. Tools sit to the right; scope/year sit beside the name.
**Why:** This is *where you are*, not a field. Caps labels would make the app shout its own name.

### 2. Inline label → value (one status fact)
**Where:** status band — `Trial months left` · `7 of 9` · meter; or `Months over` · count.
**Shape:** `.lg-label` immediately left of the figure on **one horizontal row**. Optional meter/sub after.
**Why:** One glanceable fact. Stacking would burn vertical space for a number you read once.
**Rule:** Use only for **status facts that are not editable**. Never for inputs.

### 3. Strip title → rail (attention)
**Where:** `Watch` left of the month chips.
**Shape:** `.lg-label` (sometimes `.lg-attention-title`) left; content scrolls in a rail.
**Why:** Names the row of chips without competing with them.
**Rule:** One short noun. No help sentence here.

### 4. Section toggle — left title, right meta
**Where:** `Pay cycle`, `Income`, `Year overview` (chart band).
**Shape:** sans UI label left + chevron; quiet mono **meta** right (`No schedule`, `2 over`). Whole row is the control.
**Why:** Opens/closes a block. Meta is the *answer at a glance* when collapsed.
**Rule:** Title = what the section *is*. Meta = current state in ≤4 words. Do not put `.lg-label` caps on the toggle title — it is chrome, not a field name.

### 5. Label above control (stacked field)
**Where:** Setting tiles (`Frequency`, `Payday`, `Rate`, `Checks`); 1099 lump fields (`Paid`, `Miles`, `Hours`).
**Shape:** `.lg-label` on top → control → optional help in `.lg-type-body` muted under.
**Why:** Editable values need a name *before* the hand lands on the control. Top label scales to multi-field grids.
**Rule:** Help is optional and only when the label is not enough. Never invent help to fill space. Suffixes (`miles`, `an hour`) are `.lg-type-micro` inside the field, not a second label.

### 6. Label above value, trailing (summary stack)
**Where:** job card header — `Before tax · 2026` above the year total, right-aligned.
**Shape:** `.lg-label` on top, `.lg-type-title` money below, `items-end`.
**Why:** Read-only summary owned by the card; not a field you edit in place.
**Rule:** Trailing stack = **computed totals**. Leading stack (pattern 5) = **inputs**.

### 7. Column header (table thead)
**Where:** month ledger table; analysis table.
**Shape:** `.lg-label` in `<th>`. Alignment **matches the column**: left for names/months, right for money/hours, center for actions (`Clear`).
**Why:** Headers must share an edge with the figures under them (same inset as `.lg-ledger-input`).
**Rule:** Never left-align a money column header. Never use section-toggle styling for columns.

### 8. Card eyebrow
**Where:** analysis month cards — month name as `.lg-label` at top of the card.
**Shape:** caps label as the card’s own title; figure below.
**Why:** The card *is* the month; the eyebrow names it without a full section toggle.
**Rule:** One eyebrow per card. Status/dot sits opposite on the same row.

### 9. Segment as label (no separate name)
**Where:** Job/Gig add split; Ongoing / Paused / Ended; Bank deposit / Gross pay; Cards / Table.
**Shape:** The selected segment *is* the label. Optional muted sentence under (pay basis consequence).
**Why:** Mutually exclusive modes. A caps label above would duplicate what the segment already says.
**Rule:** If the control has 2–4 exclusive options, prefer segments. Add under-copy only when the choice changes precision or meaning.

### 10. Inline body prompt (not a label)
**Where:** `Since` / end-date row beside lifecycle.
**Shape:** `.lg-type-body` muted sentence case beside the control — **not** `.lg-label`.
**Why:** Grammatical glue (“Since [month]”), not a field taxonomy.
**Rule:** If you’d read it aloud as part of a sentence, it is body — not caps label.

### 11. Legend / caption row
**Where:** Under / Near / Over swatches under analysis.
**Shape:** swatch + caption text (not `.lg-label` shouting).
**Why:** Explains encoding; must stay quieter than column headers and figures.
**Rule:** Legends never use `.lg-label`. Caption or body muted only.

### 12. Precision / grade line
**Where:** status band — `ESTIMATE · job · add payday`.
**Shape:** `PrecisionLine` (grade + why). Not a field label.
**Why:** Trust in the numbers above, not a name of a control.
**Rule:** Do not restyle this as `.lg-label`. It is its own component.

### 13. Disclaimer / footnote
**Where:** bottom of analysis.
**Shape:** full-width band, `.lg-type-body` muted.
**Why:** Legal/planning caveat — quietest prose on the page.
**Rule:** Never caps. Never a section toggle.

---

## Hierarchy on the page (top → bottom)

```
1. Page title (sans)                    identity
2. Status: inline label → figure        one fact
3. Attention: strip title → chips       watch list
4. Tabs (ui)                            which job
5. Job name (title) + trailing stack    who / how much
6. Segments (lifecycle, pay basis)      mode
7. Section toggles (ui + meta)          open blocks
8. Stacked field labels → inputs        entry
9. Table column headers → cells         dense entry / analysis
10. Card eyebrows → figures             month cards
11. Legends, precision, disclaimer      quiet explanation
```

If two patterns compete for the same slot, prefer the **higher** one only when
the content is truly that kind of thing (e.g. don’t promote a field name to a
section toggle just to make it louder).

---

## Decision tree

```
Is it the name of the app / job / page?
  → Page identity or job title (sans/title). No .lg-label.

Is it opening/closing a whole block?
  → Section toggle (left title, right meta).

Is it one of 2–4 exclusive modes?
  → Segment (the option is the label).

Is it naming a column in a table?
  → Column header (.lg-label, align with cells).

Is it naming an editable field?
  → Label above control (stacked). Help only if needed.

Is it a read-only total on a card header?
  → Trailing label-above-value stack.

Is it a single status fact (not editable)?
  → Inline label → value on one row.

Is it grammatical glue or a footnote?
  → Body / caption / disclaimer — never .lg-label.
```

---

## Harmony rules (consistency checks)

1. **One placement per job.** Frequency uses stacked label; do not also put “Frequency” in a section toggle title.
2. **`.lg-label` = taxonomy.** Caps labels name *kinds of data*. They do not narrate, warn, or toggle.
3. **Align with the value.** Money headers and money inputs share right inset; month shares left.
4. **Meta is quieter than title.** Section meta and standing-sub never outrank the thing they annotate.
5. **Don’t duplicate.** Type badge lives on the tab — not again on the card header. Segment text is the label — no caps title above it.
6. **Density follows role.** Page gutter on bands; card gutter inside job cards; cell pad in tables. Same role → same token (`--lg-page-gutter`, `--lg-card-gutter`, `--lg-pad-cell`).
7. **When in doubt, quieter.** Prefer caption/body over promoting something to `.lg-label` or a section toggle.

---

## Inventory (current ledger)

| Spot | Placement | Type |
|------|-----------|------|
| SSDI Tracker | page identity | title sans |
| Trial months left / Months over | inline → value | label + figure |
| Watch | strip title | label |
| Hours left / precision | grade line | PrecisionLine + standing-sub |
| Year overview | section toggle (band) | ui + meta |
| Job tabs | ui chrome | ui / badge |
| Before tax · year | trailing stack | label + title |
| Ongoing / Paused / Ended | segment | seg-item |
| Since / until | inline body prompt | body muted |
| Pay cycle / Income | section toggle | ui + meta |
| Frequency, Payday, Rate, Checks… | stacked field | label → control → help |
| Direct deposit \| Gross pay | segment + under-copy (paycycle rail) | seg + body |
| Month / Bank deposit / Hours / Clear | column header | label |
| Paid / Miles / Hours (1099) | stacked field | label → field |
| By month | analysis title | analysis-title (ui) |
| Cards \| Table / Active | segment / filter | seg / body |
| Month on status card | card eyebrow | label |
| countable | unit caption | caption |
| Chart month axis | axis pill | micro |
| Under / Near / Over | legend | caption + swatch |
| Hours ask button | CTA | btn |
| Planning disclaimer | footnote | body muted |

When you add a new labeled thing, extend this inventory and pick an existing
placement — do not add a fourteenth pattern without updating this file.
