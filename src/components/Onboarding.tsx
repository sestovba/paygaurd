import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTracker } from '../state/TrackerProvider';
import { money } from '../domain/format';
import { rulesFor } from '../domain/rules';
import { StreamSheet } from './StreamSheet';
import { TwpWizard } from './TwpWizard';
import { AddJobButton, BrandMark } from './ui';

export function Onboarding() {
  const { data, setUi, addStream } = useTracker();
  const [openStreamId, setOpenStreamId] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const assessed = data.twpAssessment.state !== 'unknown';
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full bg-background">
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <BrandMark />
        <div>
          <h1 className="display-figure text-4xl">PayGuard</h1>
          <p className="type-muted mt-3">
            Stay under the Trial Work amount, then under SGA once those
            9 months are used — and catch the months a weekly or biweekly
            job quietly pays you extra.
          </p>
        </div>

        {assessed ? (
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3.5 text-left">
            <p className="type-muted min-w-0">
              {data.twpAssessment.state === 'remaining'
                ? `Tracking the ${money(rulesFor(year).trialWork)} Trial Work threshold.`
                : `Tracking the ${money(rulesFor(year).sga)} SGA threshold.`}
            </p>
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="shrink-0 text-base font-medium text-primary hover:underline"
            >
              Retake
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="type-muted">
              First, a short check-in about your Trial Work Period — so
              the warnings here actually mean something.
            </p>
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="btn-primary flex w-full items-center justify-center"
            >
              Start Trial Work check-in
            </button>
          </div>
        )}

        <div className="flex w-full flex-col gap-3 [&_.add-job]:w-full">
          <AddJobButton type="w2" onClick={() => { setUi({ onboarded: true }); setOpenStreamId(addStream('w2')); }} />
          <AddJobButton type="ten99" onClick={() => { setUi({ onboarded: true }); setOpenStreamId(addStream('ten99')); }} />
          <button
            type="button"
            onClick={() => setUi({ onboarded: true })}
            className="flex items-center justify-center gap-1.5 pt-1 text-base font-medium text-muted-foreground hover:text-foreground"
          >
            Skip for now <ArrowRight className="size-4" />
          </button>
        </div>
      </main>

      {quizOpen ? <TwpWizard onClose={() => setQuizOpen(false)} /> : null}
      {openStreamId ? <StreamSheet streamId={openStreamId} onClose={() => setOpenStreamId(null)} /> : null}
    </div>
  );
}
