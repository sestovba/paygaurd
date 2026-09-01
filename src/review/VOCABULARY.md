# The review console's vocabulary

One word, one meaning. A term that means two things is worse than two terms
that mean one thing each, because the second is only verbose and the first is
wrong half the time.

This file is the list. If a label is added or changed, it goes here first —
and if it collides with something below, one of them is wrong.

The report (`review/REVIEW-NOTES.md`) uses these same words in capitals,
because the file is the other half of the conversation and a word that means
one thing in the app and another in the file is worth nothing.

---

## Objects — the things the console has

| Term | Means | Not |
|---|---|---|
| **Note** | One record about one element: what was said, its state, its thread. | The element itself. |
| **Element** | A piece of the page under review. | The note about it. |
| **Thread** | The back-and-forth on one note. Entries are **replies**. | The note. |
| **Journal** | The board of every note. | One note; the console. |
| **Console** | The whole review tool. Its sections are **panels**. | The journal. |
| **Panel** | One section of the dock: Tools, Journal, Hidden, Archive. | A column of the journal's table. |
| **Column** | A column of the journal's table: Do, Item, Where, State. | A panel. |
| **Rail** | The console docked down a side or along the bottom. | The dock on a phone. |
| **Archive** | Where elements carried off the page are kept. Holds **shelves**. | Hidden. |
| **Shelf** | One place in the Archive — left, right, top, bottom. | The Archive. |
| **Hidden** | Elements switched off where they stand. | The Archive. |

## Acts — the things you do

| Term | Means | Not |
|---|---|---|
| **Select** | Designate what the next action applies to — an element on the page, or rows in the journal. Same act, two kinds of object. | Audit. |
| **Audit** | Walk the cuts the AI proposed, answering each. | Select. |
| **Locate** | Take you to the element: switch layout and open the page if that is what it takes, scroll it into view, and flash it. | Select; Comment. |
| **Comment** | Say what should change about an element. Starts a note. | Reply. |
| **Reply** | Add to an existing note's thread. | Comment. |
| **Remove** | Take the element out of the product. A decision for the code. | Delete; Hide; Archive. |
| **Delete** | Throw away the note and its thread. The element is untouched. | Remove. |
| **Hide** | Switch the element off on screen to see the page without it. Reversible, code untouched. | Remove; Archive. |
| **Archive** | Carry the element onto a shelf. Reversible, code untouched. | Hide; Remove. |
| **Move** | Reposition the element in the layout. | Changing a note's state. |
| **Close** | Leave the console, or shut an open row. | Done. |
| **Dismiss** | Take a note off the board. A proposal I made is remembered as dismissed so it is not made again; a note you wrote has nothing to remember, so it goes. Undo brings either back. | Remove; Delete. |
| **Restore** | Put a hidden or archived element back on the page, where it came from. | Undo. |
| **Undo** | Step back through decisions. Never touches the app's own data. | Delete; Restore. |

## State — where a note has got to

The lane a note sits in. Both sides write it: `status` in
`review-notes.json`. Changing it is called **setting the state**, never
"moving" — Move means repositioning an element.

| Lane | `status` | Report | Means |
|---|---|---|---|
| **To do** | `open` | `[ ]` | Said, nothing done about it yet. |
| **Commented** | `commented` | `[!]` | You have said what you want; my move. |
| **Second look** | `second` | `[~]` | Worth revisiting. |
| **Done** | `done` | `[x]` | Acted on in the code. |
| **Not now** | `parked` | `[-]` | Deliberately deferred. Not deleted. |

## Do — what a note is asking for

The journal's first column, and its filter chips. One word for the move that
is still owed.

| Verb | When | Report |
|---|---|---|
| **Remove** | A proposed cut you agreed with. | `REMOVE` |
| **Unsure** | You looked at it and cannot call it. | `UNSURE` |
| **Change** | You asked for something; my move. | `COMMENT` |
| **Reply** | I answered; your move. | `COMMENT` |
| **Move** | The element should sit somewhere else. | `MOVE` |
| **Picked** | An A/B choice was made. | `PICKED` |
| **Apply** | An approved suggestion that is not a deletion. | `REMOVE` |
| **Archived** | Carried onto a shelf. Nothing owed. | `ARCHIVED` |
| **Hidden** | Switched off on the page. Nothing owed. | `HIDDEN` |
| **Noted** | Marked, with nothing asked of it. | — |

## Colour — what a Do is asking for

One hue per verb, and grey for the ones asking for nothing. The colour is
worn by the Do chip and by the row's own spine, so a screenful says what kind
of pass it is going to be before a word of it is read.

| Colour | Do |
|---|---|
| Red | **Remove** |
| Green | **Picked** — an A/B answered is settled, which is the one thing green has ever meant here |
| Blue | **Change**, **Reply**, **Apply** — the console's own colour, for the ones in conversation |
| Violet | **Move** — not a cut at all, a relocation |
| Amber | **Unsure** — what an open question looks like everywhere else in the console |
| Grey | **Archived**, **Hidden**, **Noted** — nothing is owed on these |

Amber and blue are also State's colours (To do, Commented). They do not
collide: State is a pill on the right of the row and Do is a chip on the
left, and a row is only ever wearing one of each.

## Collisions fixed in this pass

- **Keep** was a category for work nobody owes. A proposal turned down is a
  finished conversation, and it sat on the board as a row you read and
  skipped every time. Turning one down is now **Dismiss**, and it takes the
  note off the board rather than filing it under a verb.
- **Unsure** is the answer that was missing. Before it, a proposal you had
  considered and could not call went back into the pile with the ones you had
  not looked at yet.
- **Find it**, in the queue, and **Locate**, on a journal row, were one act
  under two names. It is **Locate**.
- **Delete** was a bin on every row of a list you are mostly reading, behind
  a confirm dialog — two frictions paying for one act, and it said the main
  thing you might do to a note is destroy it. The row's way out is **Dismiss**.
- **Show**, **Put back** and **Restore** were three words for putting a
  hidden or archived element back — one on the on-page slot, one in the
  Hidden panel, one on an archive chip. It is **Restore**.
- The Hidden panel wore an eye on its header, an eye on every row's name and
  an eye on every row's button: "hidden" three times before you reached the
  label. The header keeps it; the rows say what pressing them does.
- **Second look** (a state) and **Unsure** (a do) are close enough to be worth
  watching. They are not the same: Second look is *filed, come back to it*;
  Unsure is *not filed, cannot call it*. If they start being used
  interchangeably, one of them is wrong.

## Where the words live

`DO` in `ReviewProvider.tsx` — one map, read by the chip on the row, the
filter strip above the board, and (through `markdown.ts`) the report. Change
a value there and the word changes in all three.

What that map cannot do is add or remove an entry. `actOf` works each word
out from the note itself: approving a cut *makes* it `remove`, archiving
*makes* it `archived`. There is no field holding the word, so there is
nothing for a delete to delete except the notes.

## Read — what you have looked at

Per note, local to the browser, never in the shared file. **Unread** means it
has changed since you last looked at it. Distinct from **state**: a note can
be read and still be To do, or unread and already Done.

---

## Collisions that were fixed, and why they were collisions

- **Done** was both the button that left the console and the lane a finished
  note sits in. The button is **Close**.
- **Move to** was the bulk control for changing state, while **Move** in the
  Do column meant repositioning an element. The bulk control says **State**.
- **Stash / Stashed** and **Archive** were three words for one place. All of
  it is **Archive**, and one place in it is a **shelf**.
- **Answer** in the Do column and **Reply** on the button were one act. It is
  **Reply**.
- **Cut** read as cut-and-paste beside Move and Archive, and never said
  whether the element or the note was being cut. It is **Remove**, which
  pairs with Keep.
- **Revise** and **Change** were one act; which side owes it is what **Reply**
  already says.
- **Read** was in the Do column, which put a non-action among the actions and
  made every remark look like a chore. Reading is a **read mark**, nothing
  more.
- **The note's name** was doing two acts at once: it opened nothing and
  travelled to the element instead, while an icon beside it opened the note.
  A name opens the thing it names. Travelling to the element is **Locate**,
  and it has a button of its own.

## Deliberately one word for two objects

**Select** applies to elements on the page and to rows in the journal. It is
one definition — *designate what the next action applies to* — so it stays
one word. The same is true of **open** (a row, a panel, the console) and
**close**.
