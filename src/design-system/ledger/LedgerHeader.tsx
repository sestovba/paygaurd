import type { ReactNode } from "react";

export function LedgerHeader({
  title,
  description,
  eyebrow = "PayGuard Ledger",
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="pg-ledger-header">
      <div className="pg-ledger-header-copy">
        {eyebrow && (
          <div className="pg-ledger-eyebrow">
            {eyebrow}
          </div>
        )}

        <h1 className="pg-ledger-title">
          {title}
        </h1>

        {description && (
          <p className="pg-ledger-description">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="pg-ledger-actions">
          {actions}
        </div>
      )}
    </header>
  );
}
