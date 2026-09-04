import type {
  HTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "../../components/ui/cn";

export type LayoutRootProps =
  Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children: ReactNode;
    layout: string;
  };

/**
 * Shared semantic root for PayGuard layout personalities.
 *
 * It deliberately has no visual opinion.
 * Ledger, Pocket, Plan, PayGuard, etc. keep their own classes.
 *
 * data-chrome-root is important because shared chrome such as
 * NotificationsBell already resolves its host through this marker.
 */
export function LayoutRoot({
  children,
  layout,
  className,
  ...props
}: LayoutRootProps) {
  return (
    <div
      {...props}
      className={cn("pds-layout-root", className)}
      data-layout={layout}
      data-chrome-root
    >
      {children}
    </div>
  );
}
