import type { ReactNode } from "react";
import { cx } from "../utils";

export function Surface({
  children,
  padding = "md",
  className,
}: {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}) {
  const paddingValue = {
    none: 0,
    sm: 16,
    md: 24,
    lg: 32,
  }[padding];

  return (
    <section
      className={cx("pg-surface", className)}
      style={{
        padding: paddingValue,
        minWidth: 0,
        border: "1px solid var(--pg-color-border)",
        borderRadius: "var(--pg-radius-lg)",
        background: "var(--pg-color-surface)",
        boxShadow: "var(--pg-shadow-sm)",
      }}
    >
      {children}
    </section>
  );
}
