import type { ReactNode } from "react";

export function LedgerMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  return (
    <div
      className="pg-metric"
      data-tone={tone}
    >
      <div className="pg-metric-label">
        {label}
      </div>

      <div className="pg-metric-value">
        {value}
      </div>

      {detail && (
        <div className="pg-metric-detail">
          {detail}
        </div>
      )}
    </div>
  );
}

export function LedgerMetricGrid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="pg-metric-grid">
      {children}
    </div>
  );
}
