import { Sheet } from './Sheet';
import { TwpStatusForm } from './TwpStatusForm';
import { SafeWorkSimulator } from './SafeWorkSimulator';

export function StatusSheet({ onClose }: { onClose: () => void }) {
  return (
    /* Was "Benefit Status & Simulation" over "TWP & SGA" — a title naming
       two genres of screen and an eyebrow naming two rules, on a sheet that
       does one thing: works out what you are allowed to earn and how many
       hours that is. */
    <Sheet title="Your limit" eyebrow="Where you stand right now" size="lg" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <TwpStatusForm />
        <SafeWorkSimulator />
      </div>
    </Sheet>
  );
}
