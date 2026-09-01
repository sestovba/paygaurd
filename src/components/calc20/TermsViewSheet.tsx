import { TermsContent } from './TermsContent';
import { SheetSurface } from './SheetSurface';

export function TermsViewSheet({
  acceptedAt,
  onClose
}: {
  acceptedAt?: string;
  onClose: () => void;
}) {
  return (
    <SheetSurface label="Terms & privacy" eyebrow="Tracker" title="Terms & privacy" onClose={onClose}>
      {acceptedAt ? (
        <p className="help-note help-note--tight">
          You agreed to this version on {new Date(acceptedAt).toLocaleDateString()}.
        </p>
      ) : null}
      <TermsContent />
    </SheetSurface>
  );
}
