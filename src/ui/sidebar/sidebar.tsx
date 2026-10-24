import "@/ui/styles/globals.css";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "./sidebar.css";

import { createRoot } from "react-dom/client";

import { SidebarShell } from "./SidebarShell";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { DialogLayoutProvider } from "@/ui/components/ui/dialog";
import { AppToaster } from "@/ui/components/ui/toast";
import { LocaleRefresh } from "@/ui/i18n/LocaleRefresh";
import { installSettingsAPI } from "@/ui/internal-api/settings-api";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

installSettingsAPI();

document.title = BRAND_DISPLAY_NAME;

// Dialogs cover the whole panel: on a narrow side panel any outer margin is wasted.
const App = () => (
  <ThemeProvider>
    <LocaleRefresh>
      <DialogLayoutProvider layout="fill">
        <SidebarShell />
        <AppToaster />
      </DialogLayoutProvider>
    </LocaleRefresh>
  </ThemeProvider>
);

const container = document.querySelector("#app");

if (!container) {
  throw new Error("Missing app root for sidebar.");
}

createRoot(container).render(<App />);
