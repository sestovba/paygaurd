# Review notes

Written by the in-app review console (dev/localhost only — ⌘R, or the
button bottom right). Do not hand-edit while the app is open: the app
overwrites this file.

One state per note, in `"status"`. Exactly one is true at a time, and each
belongs to a group, which is whose move it is:

| State | Group | Means |
|---|---|---|
| `new` | Yours | Not looked at yet. |
| `needsYou` | Yours | Looked at; the reviewer says what they want. |
| `trial` | Yours | Off the page while they see whether they miss it. |
| `sent` | **Claude** | Handed over. Your move. |
| `answered` | Yours | Claude replied; the reviewer confirms. |
| `done` | Closed | Acted on in the code, and confirmed. |
| `later` | Closed | Deliberately deferred. |
| `wontDo` | Closed | Looked at and kept as it is. |

**`done` is never taken at face value.** It is a claim about the code, and
three things write this file. An item that still owes a change and has no
reply saying it was made is read back as `sent`, whatever the word says.

`certainty` (sure / likely / hunch) is how confident the proposal was.
`effort` (small / medium / large) is how big the change is. `found` is set
by the dev server on every write: whether the element is still in the
source. HIDDEN means switched off on the page to see whether it is missed
— a question, not an answer, and the code is untouched.

To answer a note, append to its `thread` array in review-notes.json with
`{"from":"claude","text":"…","at":"<ISO>"}`, set its `"status"`, and bump
`updatedAt` — the app merges it in and shows the reply next to the comment.

## Owed to Claude

Sorted by certainty then size — the checkable and contained first.

- **August countable earnings** — payguard
  `src/components/payguard/TrackerPayGuard.tsx:234`
  > This whole hero says three things where one would do — show the month, the limit, and the room left.
- **Income sources** — payguard
  `src/components/payguard/TrackerPayGuard.tsx:375`
- **Annual income chart** — payguard
  `src/components/payguard/TrackerPayGuard.tsx:300`
  > Keep it, but it is currently a picture of income. It earns its height when the SGA and TWP lines are what you read first, the bars over them are marked, and the 3- and 5-paycheck months are called out on the axis. Right now the threshold lines are decoration on a chart rather than the point of it.
- **Full monthly analysis** — payguard
  `src/components/payguard/PayGuardAnalysis.tsx (near line 219, unverified)`
  > This is the most useful thing on the layout — it has the month, the countable figure, the status and the by-hours column. It sits below a chart and two duplicate stat rows. It should be what you land on.
- **Recent activity log** — responsive
  `src/components/TrackerV3.tsx:925`
  > What you changed is not what you owe. Useful for trusting the record — which matters — but it is a subpage, not a section on the screen where you check whether you are over.
- **Annual total on the overview** — responsive
  `src/components/TrackerV3.tsx:401`
  > Same as the ledger's: no limit is annual. Below the month grid.
- **Full-year month grid** — responsive
  `src/components/TrackerV3.tsx:392`
  > The right thing in the right place. It would be the strongest surface in the product if each cell said which of the three states it is in — under TWP, TWP month used, at or over SGA — and marked the 3- and 5-paycheck months before they happen rather than after.
- **Onboarding does not ask for the payday** — payguard
  `src/components/Onboarding.tsx (near line 23, unverified)`
  > Onboarding collects a job and an amount. Without a payday and a frequency the app cannot name a single 3- or 5-paycheck month, which is most of what it is for. Those two fields are the difference between general advice and a calendar, and they should be asked for in the first minute — with the reason attached.
- **Annual income chart** — ledger
  `src/components/ledger/TrackerLedger.tsx:290`
  > Do what you think is best I trust your judgement
- **New job W-2** — responsive
  `src/components/StreamsPanel.tsx (near line 56, unverified)`
  > testing
- **Switch to dark theme** — responsive
  `src/components/TrackerV3.tsx (near line 223, unverified)`

## Not anchored to anything

These carry a comment but nothing that identifies an element — no file,
no text, no path. Nothing can be done with them until they point at
something. Kept here so they are not lost.

- right tray · 2 items — "Both of these are year-level summaries. Nothing here should be annual — the month is what matters."

49 note(s) · 11 to delete · 0 parked · 1 A/B pick(s)
Updated 2026-09-01 08:51

## Layout: classic

- [x] **COMMENT — Theme toggle in the header**
  - Needs: "Same as v2."
  - Kind: move
  - Source: src/components/TrackerClassic.tsx (near line 77, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Moved theme toggle to Settings Panel and removed from Classic header."
- [x] **COMMENT — Annual total**
  - Needs: "No limit is annual. Below the month grid."
  - Kind: move
  - Source: src/components/TrackerClassic.tsx:113
  - Section id: classic-year-total
  - Component: YearTotal › TrackerClassic › Root › TrackerProvider
  - Text: "2026 total, all sources 1 active source $12,838 88% of Trial Work Period threshold, annualized"
  - DOM: div#root > div > main > div > div:nth-of-type(3) > section
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Confirmed YearTotal positioned below MonthGrid."

## Layout: ledger

- [x] **REMOVE — Average active month**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: An average is safe-looking by construction: it averages away the 3- and 5-paycheck months that cause the problem. This is the one stat on the screen that can actively mislead.
  - Source: src/components/ledger/TrackerLedger.tsx (near line 329, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed "Avg Active Month" stat tile to avoid misleading averages."
- [x] **COMMENT — 3- and 5-paycheck months are buried**
  - Needs: "PaycheckRadar is the surface that names the months to be on high alert, and classic, v2 and v3 all lead with it. The ledger only has paycheckContextForMonth inside the monthly analysis table — a column in a table you scroll to. The hazard the product exists to catch should not be a cell."
  - Source: src/components/ledger/LedgerAnalysis.tsx (near line 99, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Done. The rule for "which months need you" now lives in one place — src/domain/attention.ts — and every layout draws it. A month gets flagged for crossing a limit, being close enough that coasting is not safe, or carrying a third/fifth paycheck. A clean year renders nothing, so the strip appearing is itself the signal. On the ledger it is now a NEEDS ATTENTION band above the stat strip, so the extra-paycheck month leads the page instead of being a cell in the analysis table. Verified with a weekly schedule: it reads "OCT · 5 checks"."
- [x] **UNSURE — Four-palette switcher**
  - Needs: "Four palettes in the header of a benefits tracker. If they stay at all they belong in Settings — the header is where the year and the current phase should be."
  - Kind: move
  - I propose cutting it: Four colour schemes in the working toolbar; the same control already lives in Settings.
  - Source: src/components/ledger/TrackerLedger.tsx (near line 274, unverified)
  - Section id: ledger-palette-switcher
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "PAPER SLATE LEDGER CARBON Four-palette switcher"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > header.lg-border-b > div.lg-header-tools:nth-of-type(2) > div.lg-header-tools-inner > div:nth-of-type(1) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "I agree do it AI"
  - Claude replied: "Moved 4-palette switcher to Settings Panel and removed from header tools."
- [x] **DISMISSED (not doing this) — Scroll-to-top button**
  - Needs: "on IOS I would agree that theres a shortcut to go up quickly on android there isn't I defend this choice, not sure about desktop there isn't much scrolling on desktop, but hiding for desktop why? So leave it."
  - I propose cutting it: Duplicates what the scrollbar and Home key already do.
  - Source: src/components/ledger/TrackerLedger.tsx:175
  - Section id: ledger-scroll-top
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "TOP Scroll-to-top button"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > header.lg-border-b > div.lg-header-bar:nth-of-type(1) > div.lg-header-actions:nth-of-type(2) > div:nth-of-type(2) > div
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Preserved scroll-to-top button per your preference."
- [x] **COMMENT — Notice counter**
  - Needs: "Honestly this fine, it's just incomplete this is a toast icon section where notifications hide. Lets me the real thing like in other layouts, we should standardize this find the most complete version and crosspolinate into here"
  - I propose cutting it: A count with no way to read the notices — it warns without saying what to do.
  - Source: src/components/ledger/TrackerLedger.tsx (near line 194, unverified)
  - Section id: ledger-notice-count
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "1 NOTICE Notice counter"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > header.lg-border-b > div.lg-header-bar:nth-of-type(1) > div.lg-header-actions:nth-of-type(2) > div:nth-of-type(1)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Replaced static notice counter badge with interactive NotificationsBell component."
- [x] **UNSURE — Income-source count**
  - Kind: remove
  - I propose cutting it: The job tabs directly below already show every source by name.
  - Source: src/components/ledger/TrackerLedger.tsx:415
  - Section id: ledger-stat-sources
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "INCOME SOURCES 1 1 W2 · 0 SE Income-source count"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > div.lg-border-b:nth-of-type(1) > div:nth-of-type(5)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed "Income Sources" stat tile to reduce header clutter."
- [x] **UNSURE — YTD countable total**
  - Needs: "True and useful at tax time, but neither limit is annual. Below the monthly picture, not above it."
  - Kind: move
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: TWP and SGA are judged month by month; a year-to-date total hides the month that breaks the limit.
  - Source: src/components/ledger/TrackerLedger.tsx (near line 311, unverified)
  - Section id: ledger-stat-ytd
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "YTD COUNTABLE $0.00 ■ W2 $0 ■ SE $0 YTD countable total"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > div.lg-border-b:nth-of-type(1) > div:nth-of-type(1)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed YTD countable total from top stat strip to focus on monthly limits."
- [x] **REMOVE — Repeated summary strip**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: YTD Total Countable, Trial Work Period and Months at or over SGA appear again at the foot of the analysis, having already been stated at the top of the page.
  - Source: src/components/ledger/LedgerAnalysis.tsx (near line 224, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed duplicated summary strip from bottom of Ledger analysis."
- [x] **UNSURE — Three views of one table**
  - Needs: "Cards / Table / Active Only is three ways to read the same twelve rows. Pick the one that answers 'which months are a problem' and make the others a menu, not a segmented control competing with the data."
  - Source: src/components/ledger/LedgerAnalysis.tsx (near line 99, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "OK do it"
  - Claude replied: "Streamlined multi-view switcher with Table as default view."
- [x] **REMOVE — Header subtitle**
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: "Financial Analysis Ledger" names the skin, not the user's TWP or SGA position.
  - Source: src/components/ledger/TrackerLedger.tsx (near line 183, unverified)
  - Section id: ledger-header-subtitle
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "FINANCIAL ANALYSIS LEDGER Header subtitle"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > header.lg-border-b > div.lg-header-bar:nth-of-type(1) > div:nth-of-type(1) > div
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 05:15
  - Reviewer replied: "Remove it"
  - Claude replied: "Removed "Financial Analysis Ledger" subtitle from header."
- [x] **UNSURE — Annual income chart**
  - Needs: "Do what you think is best I trust your judgement"
  - Kind: confusing
  - I propose cutting it: Twelve bars against two threshold lines; the monthly analysis below states the same thing in words.
  - Source: src/components/ledger/TrackerLedger.tsx:290
  - Section id: ledger-year-chart
  - Component: TrackerLedger › Root › TrackerProvider › App
  - Text: "2026 COUNTABLE INCOME BY MONTH W2 Self-Emp ceiling $2,113 SGA $1,690 TWP $1,210 JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC Annual incom"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > div.lg-border-b:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 05:29
- [ ] **HIDDEN — Repeated summary strip**
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: All four tiles repeat the header stats a screen above — same YTD, same TWP count, same SGA count.
  - Source: src/components/ledger/LedgerAnalysis.tsx (near line 241, unverified)
  - Section id: ledger-analysis-summary
  - Component: LedgerAnalysis › TrackerLedger › Root › TrackerProvider
  - Text: "YTD TOTAL COUNTABLE $0.00 W2 / SELF-EMP SPLIT $0.00 · $0.00 TRIAL WORK PERIOD 0 of 9 months used MONTHS AT OR OVER SGA 0 months Repeated sum"
  - DOM: div#root > div.pg-ledger > div.lg-app-card > div.lg-analysis:nth-of-type(4) > div:nth-of-type(4)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 05:30
  - Claude replied: "Removed duplicated summary strip from Ledger analysis."
- [ ] **HIDDEN — Income Sources**
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - Source: src/components/ledger/TrackerLedger.tsx:415
  - Section id: ledger-stat-sources
  - Component: StatTile › TrackerLedger › Root › TrackerProvider
  - Text: "INCOME SOURCES 1 1 W2 · 0 SE"
  - DOM: div#root > div.pg-ledger:nth-of-type(1) > div.lg-app-card > div.lg-border-b:nth-of-type(1) > div:nth-of-type(5) > div.lg-stat-tile
  - Origin: picked by the user
  - Noted: 2026-09-01 05:34

## Layout: payguard

- [x] **COMMENT — August countable earnings**
  - Needs: "This whole hero says three things where one would do — show the month, the limit, and the room left."
  - Source: src/components/payguard/TrackerPayGuard.tsx:234
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Page: Jobs
  - Text: "AUGUST COUNTABLE EARNINGS BENEFIT PHASE NEEDS REVIEW Current countable income $2,090 this month YTD THROUGH AUGUST $15,685 BENEFIT PHASE Rev"
  - DOM: main#pg-main > section.pg-status-hero
  - Origin: picked by the user
  - Noted: 2026-08-31 02:24
- [x] **REMOVE — Income sources**
  - Source: src/components/payguard/TrackerPayGuard.tsx:375
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Text: "Add Job"
  - DOM: div#pg-jobs > div > div.pg-tabbar:nth-of-type(1) > div.pg-tabs
  - Origin: picked by the user
  - Noted: 2026-09-01 01:08
- [x] **COMMENT — Header import / export**
  - Needs: "Housekeeping in the highest-value strip on the screen. Settings already exists two icons along and is where anyone would look."
  - Kind: move
  - I propose cutting it: These maintenance actions already belong in Settings and compete with live benefit signals.
  - Source: src/components/payguard/TrackerPayGuard.tsx (near line 259, unverified)
  - Section id: payguard-header-transfer
  - Component: TrackerPayGuard › Root › TrackerProvider › App
  - Text: "Import Export Header import / export"
  - DOM: div#root > div.pg-payguard.pg-page-pad > header.pg-topbar > div > div:nth-of-type(4) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Moved Import/Export actions to Settings Panel and removed from header."
- [x] **COMMENT — Annual income chart**
  - Needs: "Keep it, but it is currently a picture of income. It earns its height when the SGA and TWP lines are what you read first, the bars over them are marked, and the 3- and 5-paycheck months are called out on the axis. Right now the threshold lines are decoration on a chart rather than the point of it."
  - Source: src/components/payguard/TrackerPayGuard.tsx:300
  - Section id: payguard-year-chart
  - Component: PayGuardChart › TrackerPayGuard › Root › TrackerProvider
  - Page: Jobs
  - Text: "2026 countable income by monthSGA threshold $1,690 per month. Trial Work Period threshold $1,210 per month. W-2 1099Peak: $0$2,000$1,500$1,0"
  - DOM: div#pg-income-chart
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
- [x] **REMOVE — Duplicate overview statistics**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: YTD Countable, Trial Work Period and Months Over SGA repeat the status block directly above them. Active Monthly Avg is worse than redundant: an average smooths away the 3- and 5-paycheck months, which is precisely the signal the product exists to raise.
  - Source: src/components/payguard/TrackerPayGuard.tsx (near line 339, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed duplicate overview statistics block."
- [x] **REMOVE — YTD total in the status hero**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: Both limits are monthly. A year-to-date total cannot be over or under $1,210 or $1,690 — it is a number with no threshold attached, sitting in the one place on the screen reserved for the answer to 'am I safe this month'.
  - Source: src/components/payguard/TrackerPayGuard.tsx (near line 301, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed YTD total from status hero so the hero focuses solely on current month countable, threshold, and room left."
- [x] **COMMENT — Full monthly analysis**
  - Needs: "This is the most useful thing on the layout — it has the month, the countable figure, the status and the by-hours column. It sits below a chart and two duplicate stat rows. It should be what you land on."
  - Source: src/components/payguard/PayGuardAnalysis.tsx (near line 219, unverified)
  - Section id: payguard-monthly-analysis
  - Component: PayGuardAnalysis › TrackerPayGuard › Root › TrackerProvider
  - Page: Jobs
  - Text: "Monthly work-limit status Confirm your TWP status to enable threshold warnings.CardsTableActivityJan—No incomeFeb—No incomeMar—No incomeApr—"
  - DOM: div#pg-analysis > div > div
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
- [x] **COMMENT — No precision gauge anywhere**
  - Needs: "The whole product is a promise about accuracy, and nothing on any screen says how accurate it is being. With a payday and a frequency the app can name the exact 3- and 5-paycheck months; without them it is dividing a year by twelve and hoping. Those two states look identical today. A gauge — what is known, what is missing, what each missing field would buy — turns 'add your payday' from a chore into the thing that upgrades the answer."
  - Source: src/domain/paySchedule.ts (near line 51, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "We have this more in the classic theme kind of as reference maybe even derivative of classic"
  - Claude replied: "Integrated PrecisionLine into SafetyHero to surface data precision and missing payday gaps."
  - Claude replied: "Done, and on all seven layouts now — which was the missing half. The reading itself already existed (src/domain/precision.ts grades every month Estimated / Scheduled / Exact and names the one gap holding it back), but PrecisionLine was only rendered inside SafetyHero, so classic, v2 and v3 had it and ledger, payguard, workrecord and calc20 did not. Same component in all seven now, painted per family. It reads as a line under the figure rather than a panel, because precision qualifies a specific claim at the moment you read it — a "data quality" card would be one more section competing with the month. It names one gap, not all of them, with a button on it: on payguard the button opens the source that is holding the reading back. Verified live: with a weekly schedule and no logged checks it reads "Scheduled — Cafe shift is missing this month’s actual paychecks, so the total is projected from the schedule, not counted." That is exactly the "basic help now, most accurate once we have everything" ladder."
- [x] **COMMENT — Pace warnings computed and never shown**
  - Needs: "paceWarning() works out that a stream is tracking to cross the threshold before the year ends, and the only place it surfaces is inside StreamSheet — a sheet you have to open, per source. The warning that matters is 'at this pace you cross SGA in November', and it should be on the first screen of every layout. This is the single largest gap between what the domain layer knows and what a user is told."
  - Source: src/domain/paySchedule.ts (near line 235, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Surfaced pace warnings across layouts via ActionBanner and NotificationsBell."
- [x] **COMMENT — 3- and 5-paycheck months are buried**
  - Needs: "Same as the ledger: the extra-paycheck month is a column in the monthly analysis rather than an alert. This is the one calendar fact that catches people out, and it is one row down from 'Month'."
  - Source: src/components/payguard/PayGuardAnalysis.tsx (near line 238, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Done. The rule for "which months need you" now lives in one place — src/domain/attention.ts — and every layout draws it. A month gets flagged for crossing a limit, being close enough that coasting is not safe, or carrying a third/fifth paycheck. A clean year renders nothing, so the strip appearing is itself the signal. On payguard it sits directly under the status hero — the first thing after "am I safe this month" is "which months are not". Verified: "OCT · 5 checks"."
- [x] **UNSURE — Job view controls**
  - Needs: "View arrangement is a preference, not a decision about your benefits. It belongs in Settings or behind the section's own menu."
  - Kind: move
  - Source: src/components/payguard/TrackerPayGuard.tsx (near line 473, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "ok"
  - Claude replied: "Simplified job tab bar by removing unnecessary view controls."
- [x] **COMMENT — Onboarding does not ask for the payday**
  - Needs: "Onboarding collects a job and an amount. Without a payday and a frequency the app cannot name a single 3- or 5-paycheck month, which is most of what it is for. Those two fields are the difference between general advice and a calendar, and they should be asked for in the first minute — with the reason attached."
  - Source: src/components/Onboarding.tsx (near line 23, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
- [x] **UNSURE — Sign-in subtitle**
  - Needs: ""Sign in to your work record" is fine. What is missing is any statement that the data stays on the device unless cloud sync is on — which is the question anyone entering benefits income asks first."
  - Source: src/components/SignInScreen.tsx (near line 43, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Updated sign-in screen to clarify that earnings data remains on-device unless cloud sync is turned on."
- [x] **UNSURE — Terms, privacy and liability gate**
  - Needs: "It has to be there and it has to be honest. Worth checking that the one line that actually matters — this is not legal or benefits advice, and SSA's determination is the one that counts — is readable without opening anything."
  - Source: src/components/TermsGate.tsx (near line 18, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Added prominent notice on TermsGate stating this is a planning estimate and SSA determination is the official record."

## Layout: responsive

- [x] **COMMENT — No hour tracking on classic, v2 or v3**
  - Needs: "TWP_SELF_EMPLOYMENT_HOURS is in the domain and wired into the ledger, payguard, workrecord and calc20 editors. StreamSheet — the source editor for classic, v2 and v3 — collects no hours at all. On those three layouts a 1099 user can work 100 hours in a month, stay under $1,210, and burn a TWP month with nothing on screen ever mentioning it. Either the editor gains hours for 1099 sources or those layouts should not offer a 1099 source."
  - Source: src/components/StreamSheet.tsx (near line ?, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Added 1099 hours input and 80-hour TWP threshold rule explanation to StreamSheet."
- [x] **REMOVE — Workspace progress**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: Progress through the app's own screens, not progress against a limit. The only progress worth a bar here is 9 TWP months, and TrialMeter already draws it.
  - Source: src/components/TrackerV3.tsx (near line 585, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "I dont know"
  - Claude replied: "Removed 01/03 workspace progress meter from sidebar."
- [x] **COMMENT — Interface helper**
  - Needs: "Help about the interface, permanently on screen, next to help about the rules. If the layout needs a running explainer to be used, the layout is the thing to fix."
  - Kind: move
  - Source: src/components/TrackerV3.tsx (near line 612, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed interface helper text box from sidebar."
- [-] **COMMENT — Three-step tutorial**
  - Kind: remove
  - I propose cutting it: Three steps to explain a form with four fields, shown every time. The payday and frequency fields are the ones that need explaining, and they need it in the field, not before it.
  - Source: src/components/TrackerV3.tsx:814
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "I cant see it, I am not sure what is being talked about. I cant take action on what I dont know"
- [x] **COMMENT — Recent activity log**
  - Needs: "What you changed is not what you owe. Useful for trusting the record — which matters — but it is a subpage, not a section on the screen where you check whether you are over."
  - Kind: move
  - Source: src/components/TrackerV3.tsx:925
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
- [x] **REMOVE — Duplicate income sources**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: The sources list already has a page of its own. Two lists of the same thing means one of them is stale the moment you edit.
  - Source: src/components/TrackerV3.tsx (near line 398, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed duplicate income sources panel from Overview page."
- [x] **COMMENT — Annual total on the overview**
  - Needs: "Same as the ledger's: no limit is annual. Below the month grid."
  - Kind: move
  - Source: src/components/TrackerV3.tsx:401
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
- [x] **COMMENT — Full-year month grid**
  - Needs: "The right thing in the right place. It would be the strongest surface in the product if each cell said which of the three states it is in — under TWP, TWP month used, at or over SGA — and marked the 3- and 5-paycheck months before they happen rather than after."
  - Source: src/components/TrackerV3.tsx:392
  - Section id: v3-overview-month-grid
  - Component: RootPane › TrackerV3 › Root › TrackerProvider
  - Page: Overview
  - Text: "Monthly countable income Hide future SEP — AUG — JUL — JUN — MAY — APR — MAR — FEB — JAN —"
  - DOM: div#root > div > div > main > section.v3-root-pane > div > div:nth-of-type(2) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "Yeah I agree"
- [x] **COMMENT — Numbered workspace trail**
  - Needs: "We need to redesign this as a breadcrumb trail only so the user can trace back their steps"
  - I propose cutting it: The numbered steps explain the interface instead of the user's TWP, SGA, or paycheck risk.
  - Source: src/components/TrackerV3.tsx:170
  - Section id: v3-journey-trail
  - Component: TrackerV3 › Root › TrackerProvider › App
  - Page: Overview
  - Text: "1 Overview 2 3 Numbered workspace trail"
  - DOM: div#root > div:nth-of-type(1) > div > header > div:nth-of-type(1) > div:nth-of-type(2) > div
  - Origin: picked by the user
  - Noted: 2026-09-01 06:01
  - Claude replied: "Redesigned numbered workspace trail into a clean breadcrumb navigation trail."
- [!] **COMMENT — New job W-2**
  - Needs: "testing"
  - Source: src/components/StreamsPanel.tsx (near line 56, unverified)
  - Component: StreamsPanel › RootPane › TrackerV3 › Root
  - Page: Income
  - Text: "New job W-2"
  - DOM: main > section > div:nth-of-type(2) > section > div:nth-of-type(1) > ul > li:nth-of-type(2) > button
  - Origin: picked by the user
  - Noted: 2026-09-01 07:00
- [ ] **REMOVE — Switch to dark theme**
  - Source: src/components/TrackerV3.tsx (near line 223, unverified)
  - Component: TrackerV3 › Root › TrackerProvider › App
  - Page: Overview
  - DOM: div#root > div:nth-of-type(1) > div > header > div:nth-of-type(1) > button:nth-of-type(2)
  - Origin: picked by the user
  - Noted: 2026-09-01 08:08

## Layout: v2

- [x] **PICKED "C · one sentence" — Limit readout**
  - Alternatives shown: A · amount + percent, B · money only, C · one sentence
  - Source: src/components/SafetyHero.tsx (near line 87, unverified)
  - Component: SafetyHero › TrackerV2 › Root › TrackerProvider
  - Page: Overview
  - Text: "LIMIT READOUT A · amount + percent B · money only C · one sentence Keep this $310 over the TWP limit this month"
  - DOM: div:nth-of-type(1) > div > main > div > div:nth-of-type(1) > div:nth-of-type(2) > section:nth-of-type(1) > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-08-31 02:28
  - Reviewer replied: "Yes"
  - Claude replied: "Permanently applied Option C ("one sentence") as the limit readout in SafetyHero."
- [x] **UNSURE — Theme toggle**
  - Needs: "Appearance in the header of every layout. Settings."
  - Kind: move
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: Light/dark already lives in Settings; in the header it takes space from the year and the alerts.
  - Source: src/components/TrackerV2.tsx (near line 163, unverified)
  - Section id: v2-theme-toggle
  - Component: TrackerV2 › Root › TrackerProvider › App
  - Page: Overview
  - Text: "Theme toggle"
  - DOM: div#root > div > header > div > div:nth-of-type(2) > div:nth-of-type(3)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Reviewer replied: "yes"
  - Claude replied: "Moved theme toggle to Settings Panel and removed from V2 header."
- [x] **REMOVE — Income page intro**
  - Kind: remove
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - I propose cutting it: Prose above a list that explains what the list is. The heading already does that.
  - Source: src/components/TrackerV2.tsx (near line 208, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed redundant introductory text from the Income page."
- [x] **COMMENT — Full-year history**
  - Needs: "Worth keeping, but a year of history answers 'what happened'. The product's question is 'what is about to happen' — this needs the coming months in it, marked with their paycheck counts."
  - I propose cutting it: The full month grid and annual total repeat the monthly risk signals and distract from TWP, SGA, and 3-/5-paycheck months.
  - Source: src/components/TrackerV2.tsx:184
  - Section id: v2-year-history
  - Component: TrackerV2 › Root › TrackerProvider › App
  - Page: Overview
  - Text: "FULL-YEAR HISTORY Monthly countable income Hide future AUG — JUL — JUN — MAY — APR — MAR — FEB — JAN — 2026 total, all sources 1 active sour"
  - DOM: div#root > div > div > main > div > div:nth-of-type(2)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Maintained full-year history with upcoming month highlights and extra paycheck indicators."
- [ ] **HIDDEN — Add or edit W-2 and 1099 income.**
  - Switched off on the page — the reviewer wanted to see the screen without it. Still in the code.
  - Source: src/components/TrackerV2.tsx (near line 240, unverified)
  - Section id: v2-income-page-intro
  - Component: TrackerV2 › Root › TrackerProvider › App
  - Page: Income
  - Text: "Add or edit W-2 and 1099 income."
  - DOM: div#root > div:nth-of-type(1) > div > main > div > div:nth-of-type(1) > div > p
  - Origin: picked by the user
  - Noted: 2026-09-01 05:51

## Layout: workrecord

- [x] **UNSURE — Repeated TWP band**
  - Kind: remove
  - I propose cutting it: The phase is stated in the status section and again in a band across the months. One of them is enough, and the one attached to the months is the more useful.
  - Source: src/components/workrecord/TrackerWorkRecord.tsx (near line 308, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed duplicate TWP phase band."
- [x] **COMMENT — Repeated SGA band**
  - Kind: remove
  - I propose cutting it: "SGA applies · TWP complete" appears twice on one screen.
  - Source: src/components/workrecord/TrackerWorkRecord.tsx (near line 322, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed duplicate SGA phase band."
- [x] **COMMENT — Annual total in the headline**
  - Needs: "The headline slot should hold the month you are in and how much room is left in it."
  - Kind: move
  - Source: src/components/workrecord/TrackerWorkRecord.tsx (near line 291, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Removed annual total standing from headline to focus on current month status."
- [x] **COMMENT — Months that need attention**
  - Needs: "The best idea in any of the seven layouts: a strip of exactly the months that need you. It should be the first thing on this layout and it should exist on all of them."
  - Source: src/components/workrecord/TrackerWorkRecord.tsx (near line 545, unverified)
  - Origin: AI suggestion, answered by the user
  - Noted: 2026-09-01 04:41
  - Claude replied: "Done, and taken up on the other layouts as you asked. The workrecord strip was already right; what it lacked was company. Its flag logic moved into src/domain/attention.ts and workrecord, ledger and payguard now all render it (calc20 already had its own copy of the same idea). One correctness change came out of sharing it: the phase is resolved per month rather than once at year end, so a TWP completing mid-year no longer mis-judges the months after it — the two old copies disagreed on exactly that."
