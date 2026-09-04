import type { ReactNode } from "react";
import { cx } from "../utils";

type Span =
  | 1 | 2 | 3 | 4 | 5 | 6
  | 7 | 8 | 9 | 10 | 11 | 12;

export function Grid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("pg-grid", className)}>
      {children}
    </div>
  );
}

export function GridColumn({
  children,
  span = 12,
  md,
  lg,
  className,
}: {
  children: ReactNode;
  span?: Span;
  md?: Span;
  lg?: Span;
  className?: string;
}) {
  return (
    <div
      className={cx("pg-col", className)}
      data-span={span}
      data-md={md}
      data-lg={lg}
    >
      {children}
    </div>
  );
}
