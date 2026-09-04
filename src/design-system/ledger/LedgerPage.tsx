import type { ReactNode } from "react";
import { cx } from "../utils";

export function LedgerPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("pg-ledger-page", className)}>
      {children}
    </div>
  );
}
