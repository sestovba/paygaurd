import type { ThemeConfig } from "antd";

export const payguardTheme: ThemeConfig = {
  token: {
    colorPrimary: "#003366",
    colorInfo: "#4A90E2",
    colorSuccess: "#067647",
    colorWarning: "#B54708",
    colorError: "#B42318",
    colorText: "#101828",
    colorTextSecondary: "#667085",
    colorBorder: "#E4E7EC",
    colorBgLayout: "#F5F7FA",
    colorBgContainer: "#FFFFFF",
    borderRadius: 10,
    controlHeight: 40,
    fontSize: 14,
  },

  components: {
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },

    Table: {
      headerBg: "#F8FAFC",
      headerColor: "#667085",
      rowHoverBg: "#F8FBFF",
      borderColor: "#EEF2F6",
    },
  },
};
