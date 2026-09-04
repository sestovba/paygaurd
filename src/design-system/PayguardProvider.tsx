"use client";

import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { payguardTheme } from "./theme";

export function PayguardProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConfigProvider theme={payguardTheme}>
      {children}
    </ConfigProvider>
  );
}
