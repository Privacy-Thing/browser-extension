import "@/ui/styles/globals.css";
import "./popup.css";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import { createRoot } from "react-dom/client";

import { PopupApp } from "./PopupApp";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { LocaleRefresh } from "@/ui/i18n/LocaleRefresh";
import { installSettingsAPI } from "@/ui/internal-api/settings-api";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

installSettingsAPI();
document.title = BRAND_DISPLAY_NAME;

const App = () => (
  <ThemeProvider deferInitialPaint>
    <LocaleRefresh>
      <PopupApp />
    </LocaleRefresh>
  </ThemeProvider>
);

const container = document.querySelector("#app");
if (!container) throw new Error("Missing app root for popup.");
createRoot(container).render(<App />);
