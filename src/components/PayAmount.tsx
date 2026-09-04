import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTracker } from '../state/TrackerProvider';
import type { PayBasis } from '../state/storage';
import { grossFromNet } from '../domain/earnings';
import { money } from '../domain/format';
import { NumericInput } from './NumericInput';
import { Segmented } from './ui';
import type { MonthEntry } from '../domain/types';

export type { PayBasis };

/*
 * One door for the same fact.
 *
 * Review task `task-net-and-gross-two-doors`, answered "do it".
 *
 * The app had two ways in to one number and they asked for different numbers.
 * The month grid took a figure straight into `gross`, so the only thing its
 * help text could say was "the pay before tax helps us most" — a request for
 * a figure that lives on a document plenty of people cannot find. The
 * conversion from what actually reached the bank existed, but it was a link
 * ("I only know what went into my bank") on a different screen. Whichever
 * door somebody reached first decided which number they were asked for, and
 * the door most of them reach first wanted the one they do not have.
 *
 * CLAUDE.md settles which way round it should be: "The number people have is
 * net. Gross is what SSA counts and what almost nobody can find. Ask for what
 * reached the bank and convert, out loud."
 *
 * So this is one control with two modes, and the bank is the default:
 *
 *   Bank      What landed in your account. Converted here, in front of you,
 *             and stored as an estimate so the precision gauge keeps telling
 *             the truth about it.
 *   Paystub   The before-tax figure, when you have the paystub in your hand.
 *             Stored as entered, because it is.
 *
 * The switch belongs to a whole editor, not to a field: somebody who has
 * paystubs has them for every month, and asking that question twelve times is
 * twelve chances to answer it differently by accident.
 *
 * Self-employment does not use any of this. Nothing is withheld from a
 * delivery app's payout, so what reached the bank *is* the figure — a "before
 * taxes" question there would invent a distinction that does not exist and
 * cost the reader a wrong answer for it.
 */

const PayBasisContext = createContext<{
  basis: PayBasis;
  setBasis: (next: PayBasis) => void;
} | null>(null);

/** Wraps an editor so its money fields and its switch agree without every
 *  call site threading the state through. */
export function PayBasisProvider({ children }: { children: ReactNode }) {
  const { ui, setUi } = useTracker();
  const basis = ui.payBasis ?? 'bank';
  const setBasis = (next: PayBasis) => setUi({ payBasis: next });
  return (
    <PayBasisContext.Provider value={{ basis, setBasis }}>
      {children}
    </PayBasisContext.Provider>
  );
}

export function usePayBasis() {
  const ctx = useContext(PayBasisContext);
  if (!ctx) throw new Error('usePayBasis needs a PayBasisProvider above it');
  return ctx;
}

/** The words for each mode, in one place, because they are said by the
 *  switch, by every field label under it and by the sentence that explains
 *  the trade — and three near-copies of a sentence is how the two doors got
 *  out of step in the first place. */
export const PAY_BASIS_WORDS: Record<PayBasis, {
  /** On the switch. */
  tab: string;
  /** On a field, when the field has room for a label of its own. */
  field: string;
  /** What to type, said as a question. */
  ask: string;
}> = {
  bank: {
    tab: 'Direct deposit',
    field: 'Bank deposit',
    ask: 'Type what actually landed in your account.'
  },
  paystub: {
    tab: 'Gross pay',
    field: 'Before taxes',
    ask: 'Type the amount before anything was taken out.'
  }
};

/**
 * The switch, with the trade said out loud under it.
 *
 * Not a bare pair of tabs: which one somebody picks changes how exact the
 * app can be, and that is the kind of thing this product says rather than
 * hides. Keep the consequence short.
 */
export function PayBasisSwitch() {
  const { basis, setBasis } = usePayBasis();
  return (
    <div className="lg-pay-basis-switch flex flex-col">
      <Segmented
        value={basis}
        onChange={setBasis}
        options={[
          { id: 'bank', label: PAY_BASIS_WORDS.bank.tab },
          { id: 'paystub', label: PAY_BASIS_WORDS.paystub.tab }
        ]}
      />
      {/* Pattern 9: segment is the label; under-copy is body, full-bleed paycycle rail. */}
      <p className="lg-pay-basis-note lg-type-body lg-text-muted">
        {basis === 'bank'
          ? 'SSA counts before-tax pay. We estimate that from this, with room to spare.'
          : 'This is the exact number Social Security counts, so nothing has to be guessed.'}
      </p>
    </div>
  );
}

/** What to show in the field, for the mode it is in. A month entered from a
 *  paystub has no bank figure, and vice versa — an empty field is the honest
 *  answer, not a converted one. */
export function payValueFor(entry: MonthEntry | undefined, basis: PayBasis): number | undefined {
  if (!entry) return undefined;
  if (basis === 'bank') return entry.net;
  return entry.basis === 'fromNet' ? undefined : entry.gross;
}

/**
 * The patch for one month, from whichever number was typed.
 *
 * Both modes write `gross`, because that is what every calculation in the app
 * reads and nothing downstream should have to know which door this came
 * through. What differs is `basis`, which is how the precision gauge knows to
 * keep calling a converted figure a guess.
 */
export function payPatchFor(basis: PayBasis, amount: number | undefined): Partial<MonthEntry> {
  if (amount === undefined) return { gross: undefined, net: undefined, basis: undefined };
  if (basis === 'paystub') return { gross: amount, net: undefined, basis: 'entered' };
  return { gross: grossFromNet(amount), net: amount, basis: 'fromNet' };
}

/**
 * A money field that knows which number it is asking for.
 *
 * In bank mode it says what the figure comes to before taxes as it is typed.
 * That is the "convert, out loud" half: the conversion is not a thing that
 * happened to your number somewhere else, it is a thing you watched happen.
 */
export function PayAmountField({
  entry, onCommit, label, disabled, className = 'num field-input w-full', showConversion = true
}: {
  entry: MonthEntry | undefined;
  onCommit: (patch: Partial<MonthEntry>) => void;
  /** Shown above the field. Omit where the surrounding row already names the
   *  month or the job and the switch names the number. */
  label?: string;
  disabled?: boolean;
  className?: string;
  showConversion?: boolean;
}) {
  const { basis } = usePayBasis();
  const value = payValueFor(entry, basis);
  const converted = basis === 'bank' && value ? grossFromNet(value) : undefined;

  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label ? <span className="field-label px-0.5">{label}</span> : null}
      <NumericInput
        className={className}
        prefix="$"
        value={value}
        placeholder="Numbers only"
        disabled={disabled}
        aria-label={label ? `${label}, ${PAY_BASIS_WORDS[basis].field.toLowerCase()}` : PAY_BASIS_WORDS[basis].field}
        onCommit={(next) => onCommit(payPatchFor(basis, next))}
      />
      {showConversion && converted ? (
        <span className="type-muted px-0.5 text-sm">About {money(converted)} before taxes</span>
      ) : null}
    </label>
  );
}
