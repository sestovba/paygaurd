import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ButtonBase } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';

/**
 * Layer 2 — the year stepper.
 *
 * Six layouts drew this control and three of them got the bounds wrong.
 * Ledger, PayGuard and the two overview shells stepped by index through
 * `knownYears()` and disabled the ends. Beautiful clamped in its handler but
 * left both buttons looking live at the boundary, so the last click of the
 * year did nothing and said nothing. Horizon did `ui.year - 1` with no clamp
 * at all, which walks straight out of the years the app has rules for.
 *
 * The bounds are the shared behavior, so they live here. Everything you can
 * see stays with the layout: the wrapper class, the button class, the year's
 * own class, and the glyphs — Horizon wants a bare `‹`, PayGuard a 3.5 icon,
 * Ledger a 4. That is the Layer 3 line from ARCHITECTURE.md, and it is why
 * this renders `ButtonBase` rather than `Button`: a layout that owns its skin
 * keeps owning it.
 *
 * `years` is expected to be ascending and to contain `year`. If it does not,
 * both ends disable rather than stepping somewhere unrepresentable.
 */
export interface YearStepperProps {
  year: number;
  /** Selectable years, ascending — normally `knownYears()`. */
  years: number[];
  onYear: (year: number) => void;
  /** The layout's wrapper class. Buttons stay direct children of it. */
  className?: string;
  buttonClassName?: string;
  yearClassName?: string;
  prevIcon?: ReactNode;
  nextIcon?: ReactNode;
}

export function YearStepper({
  year,
  years,
  onYear,
  className,
  buttonClassName,
  yearClassName,
  prevIcon = <ChevronLeft className="size-4" />,
  nextIcon = <ChevronRight className="size-4" />,
}: YearStepperProps) {
  const index = years.indexOf(year);
  const atStart = index <= 0;
  const atEnd = index < 0 || index >= years.length - 1;

  return (
    <div className={cn('pds-year-stepper', className)} role="group" aria-label="Year">
      <ButtonBase
        type="button"
        className={buttonClassName}
        disabled={atStart}
        onClick={() => onYear(years[index - 1])}
        aria-label="Previous year"
      >
        {prevIcon}
      </ButtonBase>
      <span className={yearClassName}>{year}</span>
      <ButtonBase
        type="button"
        className={buttonClassName}
        disabled={atEnd}
        onClick={() => onYear(years[index + 1])}
        aria-label="Next year"
      >
        {nextIcon}
      </ButtonBase>
    </div>
  );
}
