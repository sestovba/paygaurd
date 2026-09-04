/**
 * What is in Settings, in what order, and what each thing is called — once,
 * for every layout.
 *
 * There are two settings screens in this app and there is no getting rid of
 * the second one: the shared `SettingsPanel` draws Tailwind rows for nine
 * layouts, and `calc20/SettingsSheet` draws `.field` / `.rows` tabs in a
 * design system with different primitives and its own `UiState` shim. Two
 * renderers is fine. Two *answers* is not, and that is what we had — the
 * order of the sections and the words on the rows were written out twice, so
 * a decision about Settings had to be made twice and could be half-made.
 *
 * It was, the first time it mattered. "Account and layout should go first,
 * benefit status and how income works last" is one instruction, and applying
 * it meant editing an array of sections in one file and an array of tabs in
 * another. Nothing connects those two arrays, so nothing would have
 * complained if only one had been touched — the layouts would simply have
 * disagreed about what Settings looks like, quietly, until someone opened
 * both.
 *
 * So the shape lives here and the markup stays where it is. This is the same
 * split `LAYOUT_GROUPS` already uses in `LayoutSwitcher.tsx`: the data is
 * shared, and each design system renders it in its own vocabulary.
 *
 * The section order is the rule that instruction set down, and it is worth
 * writing where it cannot be lost: **order is how often you touch a thing,
 * not how important it sounds.** You change your account and the way the app
 * looks; you read the rules once and then you know them.
 */

/** Every distinct thing a settings screen can offer. A layout renders the
 *  ones it can and declares them to `sectionsFor`; the rest are skipped.
 *
 *  Being in this list is not a promise that a layout draws it — it is a
 *  promise about *where it goes* and *what it is called* if it does. That is
 *  deliberate: the two screens do not offer the same set. Only calc20 has a
 *  glass slider or a clear-one-year button; only the shared panel has the
 *  palette swatches. Both used to invent their own position and wording for
 *  the ones they share. */
export type SettingsRowId =
  /* Account */
  | 'account'
  | 'sync'
  | 'terms'
  /* Appearance */
  | 'focusMode'
  | 'layout'
  | 'overviewShell'
  | 'theme'
  | 'palette'
  | 'glass'
  /* Your data */
  | 'export'
  | 'import'
  | 'clearYear'
  | 'clearAll'
  /* The rules */
  | 'benefitStatus'
  | 'howIncomeWorks';

export type SettingsSectionId = 'account' | 'appearance' | 'data' | 'rules';

export interface SettingsSection {
  id: SettingsSectionId;
  /** The heading over the section, and the tab label where there are tabs. */
  title: string;
  rows: ReadonlyArray<SettingsRowId>;
}

export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSection> = [
  {
    id: 'account',
    title: 'Account',
    rows: ['account', 'sync', 'terms']
  },
  {
    id: 'appearance',
    title: 'Appearance',
    rows: ['focusMode', 'layout', 'overviewShell', 'theme', 'palette', 'glass']
  },
  {
    id: 'data',
    title: 'Your data',
    rows: ['export', 'import', 'clearYear', 'clearAll']
  },
  {
    id: 'rules',
    title: 'The rules',
    rows: ['benefitStatus', 'howIncomeWorks']
  }
];

/**
 * One label per row, for both screens.
 *
 * These had drifted the way duplicated copy always does: the same button
 * read "Export JSON" in nine layouts and "Export tracker JSON" in calc20.
 * Unifying them was a merge, and it picked the wording nine layouts already
 * showed while noting that it was the wrong wording — "JSON" is jargon by
 * this project's own copy rule and nobody on SSDI is looking for a JSON file.
 *
 * The content audit is the copy decision that note was waiting for. Export
 * and Import now say what the buttons do rather than what file format they
 * happen to use; the file still lands as .json and the reader never has to
 * know that word. Same for the two rules rows: "Benefit status" named a
 * category, not a thing the reader has.
 */
export const SETTINGS_ROW: Readonly<Record<SettingsRowId, { label: string; help?: string }>> = {
  account: { label: 'Account' },
  sync: { label: 'Sync across devices' },
  terms: { label: 'Terms & privacy' },

  focusMode: {
    label: 'Focus',
    /* It used to say "This month only", which stopped being true when the
       layouts built to hold a year got their own month dropdown: there,
       focus mode starts the list at this month and keeps what is behind it.
       So this says what focus mode does everywhere — takes things off the
       screen — and leaves how many months to the control that shows them. */
    help: 'Hides charts and calendars. Lists start at this month.'
  },
  layout: { label: 'Layout' },
  /* Sits directly under Layout because it is a property OF the layout above
     it — the three things it chooses between used to be three entries in
     that list. Only drawn while Overview is the layout; the row is skipped
     otherwise rather than shown greyed out, because a control you cannot use
     is a question you cannot answer. */
  overviewShell: {
    label: 'Overview layout',
    help: 'One page, separate pages, or side by side.'
  },
  theme: { label: 'Theme' },
  palette: { label: 'Colour' },
  glass: {
    label: 'Glass',
    help: 'How see-through the header, menus and sheets are. 0 is see-through, 100 is solid.'
  },

  export: { label: 'Save a backup' },
  import: { label: 'Restore a backup' },
  clearYear: { label: 'Clear this year' },
  clearAll: { label: 'Erase all data on this device' },

  benefitStatus: { label: 'Your status' },
  howIncomeWorks: { label: 'How pay is counted' }
};

/**
 * The sections a screen should draw, given the rows it can actually render.
 *
 * A section with nothing left in it does not appear — that is the whole
 * mechanism for the fact that the two screens offer different sets, and it
 * means neither of them carries a list of exceptions. Pass the row ids the
 * caller knows how to draw; get back the sections, in order, each holding
 * only those rows.
 */
export function sectionsFor(
  rendered: ReadonlyArray<SettingsRowId>
): Array<{ id: SettingsSectionId; title: string; rows: SettingsRowId[] }> {
  const can = new Set<SettingsRowId>(rendered);
  return SETTINGS_SECTIONS
    .map((section) => ({
      id: section.id,
      title: section.title,
      rows: section.rows.filter((row) => can.has(row))
    }))
    .filter((section) => section.rows.length > 0);
}
