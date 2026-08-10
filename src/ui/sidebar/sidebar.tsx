import "@/ui/styles/globals.css";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "./sidebar.css";

import { createRoot } from "react-dom/client";

import { SidebarShell } from "./SidebarShell";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { AppToaster } from "@/ui/components/ui/toast";
import { installSettingsAPI } from "@/ui/internal-api/settings-api";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

installSettingsAPI();

document.title = BRAND_DISPLAY_NAME;

const App = () => (
  <ThemeProvider>
    <SidebarShell />
    <AppToaster />
  </ThemeProvider>
);

const container = document.querySelector("#app");

if (!container) {
  throw new Error("Missing app root for sidebar.");
}

createRoot(container).render(<App />);
