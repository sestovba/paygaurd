# Review notes

Written by the in-app review console (dev/localhost only — ⌘R, or the
button bottom right). Do not hand-edit while the app is open: the app
overwrites this file. Every note sits in a lane, and either side can
move it: `"status"` in review-notes.json is `"open"` (to do, `[ ]`),
`"commented"` (`[!]` — the reviewer has said what they want and it is
your move), `"second"` (`[~]` — worth another look), `"done"` (`[x]`
— acted on) or `"parked"` (`[-]` — deliberately not now).

ARCHIVED means carried onto a shelf in the app; the code is untouched and
it can be dragged back. HIDDEN means switched off with the eye — also
untouched code, and a question ("is the screen better without this?")
rather than an answer. REMOVE/KEEP/MOVE are the decisions to act on.
A `Kind:` line carries the reviewer's own tags (cut, reword, spacing…) —
the prose says what to change, the tags say what sort of change it is.
The console's own housekeeping — a stash's name, colour or folded state —
is deliberately not in here; every entry below is something to act on.

To answer a note, append to its `thread` array in review-notes.json with
`{"from":"claude","text":"…","at":"<ISO>"}` and bump that note's
`updatedAt` — the app merges it in and shows the reply next to the comment.

12 note(s) · 5 to delete · 3 parked · 1 A/B pick(s)
Updated 2026-09-01 02:22

## Layout: ledger

- [ ] **REMOVE — Average active month**
  - I proposed cutting it because: An average is safe-looking by construction — it averages away the 3- and 5-paycheck months that cause the problem.
  - Source: src/components/ledger/TrackerLedger.tsx:329
  - Section id: ledger-stat-average
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "AVG ACTIVE MONTH $1,054 TWP $1,210 / month Average active month"
  - DOM: div#root > div.pg-ledger:nth-of-type(1) > div.lg-app-card > div.lg-border-b:nth-of-type(1) > div:nth-of-type(4)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 02:55
- [ ] **KEEP (my suggestion rejected) — Header subtitle**
  - I proposed cutting it because: "Financial Analysis Ledger" names the skin, not the user's TWP or SGA position.
  - Source: src/components/ledger/TrackerLedger.tsx:165
  - Section id: ledger-header-subtitle
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "FINANCIAL ANALYSIS LEDGER Header subtitle"
  - DOM: div#root > div.pg-ledger:nth-of-type(1) > div.lg-app-card > header.lg-border-b > div.lg-header-bar:nth-of-type(1) > div:nth-of-type(1) > div
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 02:56

## Layout: payguard

- [x] **COMMENT — August countable earnings**
  - Needs: "This whole hero says three things where one would do — show the month, the limit, and the room left."
  - Source: src/components/payguard/TrackerPayGuard.tsx:282
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "AUGUST COUNTABLE EARNINGS BENEFIT PHASE NEEDS REVIEW Current countable income $2,090 this month YTD THROUGH AUGUST $15,685 BENEFIT PHASE Rev"
  - DOM: main#pg-main > section.pg-status-hero
  - Origin: picked by the user
  - Noted: 2026-08-31 02:24
- [ ] **GROUP — right tray · 2 items**
  - Needs: "Both of these are year-level summaries. Nothing here should be annual — the month is what matters."
  - Applies to: Annual income chart · Duplicate overview statistics
  - Origin: picked by the user
  - Noted: 2026-08-31 02:44
- [ ] **MOVE — Annual income chart**
  - Move: place it before August countable earnings (not satisfiable at runtime — needs a code change)
  - Source: src/components/payguard/TrackerPayGuard.tsx:401
  - Section id: payguard-year-chart
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "2026 COUNTABLE INCOME BY MONTH SGA threshold $1,690 per month. Trial Work Period threshold $1,210 per month. W-2 1099 Peak: $1,520 $2,000 $1"
  - DOM: div#pg-overview > div:nth-of-type(2)
  - Origin: picked by the user
  - Noted: 2026-08-31 02:44
- [ ] **ARCHIVED — Since**
  - Archived on the right shelf (off the page in the app, still in the code)
  - Source: src/components/payguard/PayGuardJobEditor.tsx:194
  - Component: PayGuardJobEditor › TrackerPayGuard › Root › TrackerProvider
  - Page: Jobs
  - Text: "ONGOING PAUSED ENDED Since"
  - DOM: div#pg-job-xim6tp16ktmtg4qacf > div.pg-rule-b.pg-surface-quiet:nth-of-type(2)
  - Origin: picked by the user
  - Noted: 2026-08-31 03:03
  - Reviewer replied: "Test"
  - Reviewer replied: "ssd"
- [ ] **REMOVE — YTD total in current status**
  - I proposed cutting it because: The active monthly TWP or SGA gap matters here; a year-to-date total does not.
  - Source: src/components/payguard/TrackerPayGuard.tsx:301
  - Section id: payguard-hero-ytd
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "YTD THROUGH AUGUST $8,891 YTD total in current status"
  - DOM: main#pg-main > section.pg-status-hero > div.pg-status-hero-main:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 03:03
- [ ] **ARCHIVED — August countable earnings**
  - Archived on the left shelf (off the page in the app, still in the code)
  - Source: src/components/payguard/TrackerPayGuard.tsx:282
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "AUGUST COUNTABLE EARNINGS $310 ABOVE TWP Current countable income $1,520 this month YTD THROUGH AUGUST $8,891 TWP MONTHLY THRESHOLD $1,210 B"
  - DOM: main#pg-main > section.pg-status-hero
  - Origin: picked by the user
  - Noted: 2026-08-31 03:04
- [ ] **REMOVE — Duplicate overview statistics**
  - Archived on the left shelf (off the page in the app, still in the code)
  - I proposed cutting it because: YTD, TWP, and SGA repeat the status above; averages and source counts do not guide a monthly benefit decision.
  - Source: src/components/payguard/TrackerPayGuard.tsx:339
  - Section id: payguard-overview-stats
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "YTD COUNTABLE $13,515 W-2 $11,410 1099 $2,105 TRIAL WORK PERIOD 9/ 9 used TWP $1,210 / mo MONTHS OVER SGA 3/ 12 SGA limit $1,690 / mo ACTIVE"
  - DOM: div#pg-overview > div:nth-of-type(1)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 03:13
- [ ] **KEEP (my suggestion rejected) — Header import / export**
  - I proposed cutting it because: These maintenance actions already belong in Settings and compete with live benefit signals.
  - Source: src/components/payguard/TrackerPayGuard.tsx:241
  - Section id: payguard-header-transfer
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "Import ExportHeader import / export"
  - DOM: div#root > div.pg-payguard.pg-page-pad:nth-of-type(1) > header.pg-topbar > div > div:nth-of-type(4) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 04:40
- [ ] **REMOVE — Income sources**
  - Source: src/components/payguard/TrackerPayGuard.tsx:466
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Text: "Add Job"
  - DOM: div#pg-jobs > div > div.pg-tabbar:nth-of-type(1) > div.pg-tabs
  - Origin: picked by the user
  - Noted: 2026-09-01 01:08

## Layout: v2

- [ ] **PICKED "C · one sentence" — Limit readout**
  - Alternatives shown: A · amount + percent, B · money only, C · one sentence
  - Source: src/components/SafetyHero.tsx:87
  - Component: SafetyHero › TrackerV2 › Root › TrackerProvider
  - Page: Overview
  - Text: "LIMIT READOUT A · amount + percent B · money only C · one sentence Keep this $310 over the TWP limit this month"
  - DOM: div:nth-of-type(1) > div > main > div > div:nth-of-type(1) > div:nth-of-type(2) > section:nth-of-type(1) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 02:28
