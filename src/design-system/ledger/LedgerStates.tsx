import type { ReactNode } from "react";

export function LedgerLoadingState() {
  return (
    <div
      className="pg-ledger-state"
      role="status"
      aria-live="polite"
    >
      <strong>Loading ledger…</strong>
    </div>
  );
}

export function LedgerEmptyState({
  title = "Nothing here yet",
  description = "New ledger activity will appear here.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pg-ledger-state">
      <strong>{title}</strong>
      <p>{description}</p>

      {action && (
        <div className="pg-ledger-state-action">
          {action}
        </div>
      )}
    </div>
  );
}

export function LedgerErrorState({
  title = "Couldn’t load this ledger",
  description = "Something went wrong while loading this information.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="pg-ledger-state pg-ledger-error"
      role="alert"
    >
      <strong>{title}</strong>
      <p>{description}</p>

      {action && (
        <div className="pg-ledger-state-action">
          {action}
        </div>
      )}
    </div>
  );
}
