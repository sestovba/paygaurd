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
| **Comment** | Say what should change about an element. Starts a note. | Reply. |
| **Reply** | Add to an existing note's thread. | Comment. |
| **Remove** | Take the element out of the product. A decision for the code. | Delete; Hide; Archive. |
| **Delete** | Throw away the note and its thread. The element is untouched. | Remove. |
| **Hide** | Switch the element off on screen to see the page without it. Reversible, code untouched. | Remove; Archive. |
| **Archive** | Carry the element onto a shelf. Reversible, code untouched. | Hide; Remove. |
| **Move** | Reposition the element in the layout. | Changing a note's state. |
| **Close** | Leave the console, or shut an open row. | Done. |
| **Undo** | Step back through decisions. Never touches the app's own data. | Delete. |

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
| **Keep** | A proposed cut you rejected. | `KEEP` |
| **Change** | You asked for something; my move. | `COMMENT` |
| **Reply** | I answered; your move. | `COMMENT` |
| **Move** | The element should sit somewhere else. | `MOVE` |
| **Picked** | An A/B choice was made. | `PICKED` |
| **Apply** | An approved suggestion that is not a deletion. | `REMOVE` |
| **Archived** | Carried onto a shelf. Nothing owed. | `ARCHIVED` |
| **Hidden** | Switched off on the page. Nothing owed. | `HIDDEN` |
| **Noted** | Marked, with nothing asked of it. | — |

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

## Deliberately one word for two objects

**Select** applies to elements on the page and to rows in the journal. It is
one definition — *designate what the next action applies to* — so it stays
one word. The same is true of **open** (a row, a panel, the console) and
**close**.
