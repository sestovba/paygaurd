import { Sheet } from './Sheet';
import { TwpStatusForm } from './TwpStatusForm';
import { SafeWorkSimulator } from './SafeWorkSimulator';

export function StatusSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Benefit Status & Simulation" eyebrow="TWP & SGA" size="lg" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <TwpStatusForm />
        <SafeWorkSimulator />
      </div>
    </Sheet>
  );
}
