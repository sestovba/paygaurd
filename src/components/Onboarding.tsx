import { useState } from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { rulesFor } from '../domain/rules';
import { anchorForPayday, frequencyLabel, paydayOf, payPlan } from '../domain/paySchedule';
import { shortMonthName, monthKey } from '../domain/months';
import type { PayFrequency, StreamType } from '../domain/types';
import { StreamSheet } from './StreamSheet';
import { TwpWizard } from './TwpWizard';
import { AddJobButton, BrandMark, ButtonRow, PaydayInput, Segmented } from './ui';

import { ButtonBase } from '../design-system';
const FREQUENCIES: PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

export function Onboarding() {
  const { data, setUi, addStream } = useTracker();
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const [paydayStreamId, setPaydayStreamId] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const assessed = data.twpAssessment.state !== 'unknown';
  const year = new Date().getFullYear();

  /* Review note: "Onboarding collects a job and an amount. Without a payday
     and a frequency the app cannot name a single 3- or 5-paycheck month,
     which is most of what it is for."
     So a W-2 job asks for those two fields before anything else, on a step of
     their own, with the reason on the step. A 1099 source goes straight to
     the editor — self-employment has no pay schedule to find extra checks in,
     and asking would be a question with no use for the answer. */
  function startJob(type: StreamType) {
    setUi({ onboarded: true });
    const id = addStream(type);
    if (type === 'w2') setPaydayStreamId(id);
    else setOpenStreamId(id);
  }

  return (
    /*
     * Left-aligned, not centred.
     *
     * Every line on this screen started at a different x: the brand lockup
     * was centred as a block, the title as text, the sentence as a ragged
     * paragraph, and then three full-width buttons below them. Four optical
     * left edges in six elements, which is what "needs to be aligned" was
     * looking at. One edge now, all the way down. Centred multi-line prose is
     * also the harder thing to read for the readers this app is for, and
     * DESIGN-SYSTEM.md's audience section is the reason to spend the choice
     * here rather than on symmetry.
     */
    <div className="min-h-screen w-full bg-background">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-10">
        {/*
          * The name was on the screen twice — a wordmark inside BrandMark and
          * a 36px <h1> under it saying "PayGuard" again, the same duplication
          * the sidebar had. The mark says what the app is called; the heading
          * gets to say what it is FOR, which is the one thing a person who
          * has just opened it does not know.
          *
          * And the paragraph under it was 45 words in three sentences, on the
          * first screen, before anything had been asked. Two lines now. The
          * hours claim survives because it is the product's own argument; the
          * extra-paycheck warning does not, because it is a thing the app
          * shows you later rather than something you need before tapping.
          */}
        <BrandMark subtitle="Stay under the limit" />
        <div>
          <h1 className="display-figure text-4xl">How much can you earn this month?</h1>
          <p className="type-muted mt-3">
            Stay under your limit — in hours, not just dollars.
          </p>
        </div>

        {assessed ? (
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5 text-left">
            <p className="type-muted min-w-0">
              {/* One limit, named as theirs rather than as a rule. */}
              {`Your limit is ${money(data.twpAssessment.state === 'remaining'
                ? rulesFor(year).trialWork
                : rulesFor(year).sga)} a month.`}
            </p>
            <ButtonBase
              type="button"
              onClick={() => setQuizOpen(true)}
              className="shrink-0 text-base font-medium text-primary hover:underline"
            >
              Retake
            </ButtonBase>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            {/* Was "First, a few questions. Your answers decide which monthly
                limit applies to you." — the first half of which the button
                directly under it already says. Only the half that the button
                cannot say is kept. */}
            <p className="type-muted">
              Your answers set which monthly limit applies.
            </p>
            <ButtonBase
              type="button"
              onClick={() => setQuizOpen(true)}
              className="btn-primary flex w-full items-center justify-center"
            >
              Answer a few questions
            </ButtonBase>
          </div>
        )}

        <div className="flex w-full flex-col gap-3">
          <ButtonRow>
            <AddJobButton type="w2" onClick={() => startJob('w2')} />
            <AddJobButton type="ten99" onClick={() => startJob('ten99')} />
          </ButtonRow>
          <ButtonBase
            type="button"
            onClick={() => setUi({ onboarded: true })}
            className="flex items-center justify-center gap-1.5 pt-1 text-base font-medium text-muted-foreground hover:text-foreground"
          >
            Skip for now <ArrowRight className="size-4" />
          </ButtonBase>
        </div>
      </main>

      {quizOpen ? <TwpWizard onClose={() => setQuizOpen(false)} /> : null}
      {paydayStreamId ? (
        <PaydayStep
          streamId={paydayStreamId}
          year={year}
          onDone={() => {
            const id = paydayStreamId;
            setPaydayStreamId(null);
            setOpenStreamId(id);
          }}
        />
      ) : null}
      {openStreamId ? <StreamSheet streamId={openStreamId} onClose={() => setOpenStreamId(null)} /> : null}
    </div>
  );
}

/**
 * The two fields that turn general advice into a calendar: how often you are
 * paid, and one real date you were paid on. From those the app can name every
 * 3- and 5-paycheck month in the year, which is the thing it exists to warn
 * about — and it can say so on this screen, while the reason is still in
 * front of the person who typed them.
 */
function PaydayStep({ streamId, year, onDone }: {
  streamId: string; year: number; onDone: () => void;
}) {
  const { data, updateStream } = useTracker();
  const stream = data.streams.find((s) => s.id === streamId);
  const [date, setDate] = useState(stream?.anchorDate ?? '');
  if (!stream) return null;

  const frequency = stream.payFrequency;
  const plan = frequency && date ? payPlan(year, frequency, date) : null;
  const heavy = plan?.heavyMonths ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background p-6">
      <div className="flex w-full max-w-md flex-col gap-5">
        <div>
          <p className="label-caps">Step 2 of 2</p>
          <h2 className="mt-1 text-2xl font-semibold">When does {stream.name} pay you?</h2>
          <p className="type-muted mt-2">
            Some schedules pay an extra time in certain months. Those months sit closest to your limit.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="field-label">How often you are paid</span>
          <Segmented
            value={frequency}
            columns={4}
            onChange={(payFrequency) => updateStream(stream.id, { payFrequency })}
            options={FREQUENCIES.map((f) => ({ id: f, label: frequencyLabel(f) }))}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="field-label">What day of the month are you paid?</span>
          <PaydayInput
            className="field-input"
            aria-label="Payday, day of the month"
            placeholder="1-31"
            value={paydayOf(date)}
            onCommit={(day) => {
              const next = day == null
                ? undefined
                : anchorForPayday(day, stream.activeFrom, date || undefined);
              setDate(next ?? '');
              updateStream(stream.id, { anchorDate: next });
            }}
          />
          <span className="type-muted">
            A number from 1 to 31. Every other payday follows from it.
          </span>
        </label>

        {/* The answer, on the same screen as the question. This is the whole
            argument for asking here rather than in the job editor later. */}
        {plan ? (
          heavy.length ? (
            <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-3 text-base font-semibold text-info-text">
              <Zap className="size-5 shrink-0" />
              <span>
                {plan.typicalCount + 1} paychecks in{' '}
                {heavy.map((m) => shortMonthName(monthKey(year, m))).join(', ')} this year — watch
                those months.
              </span>
            </p>
          ) : (
            <p className="type-muted rounded-lg border border-border px-3 py-3 text-base">
              Every month in {year} pays you the same number of times on this schedule. Nothing
              extra to watch for.
            </p>
          )
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <ButtonBase
            type="button"
            onClick={onDone}
            className="text-base font-medium text-muted-foreground hover:text-foreground"
          >
            I don't know yet
          </ButtonBase>
          <ButtonBase type="button" onClick={onDone} className="btn-primary">
            Continue
          </ButtonBase>
        </div>
      </div>
    </div>
  );
}
