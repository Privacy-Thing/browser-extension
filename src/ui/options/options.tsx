import "@/ui/styles/globals.css";
import "@/ui/styles/jetbrains-mono.css";
import "./options.css";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import { createRoot } from "react-dom/client";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { t } from "@/ui/i18n";
import { installSettingsAPI } from "@/ui/internal-api/settings-api";
import { App } from "@/ui/options/options-page";

installSettingsAPI();

document.title = `${BRAND_DISPLAY_NAME} ${t.options.title}`;

const container = document.querySelector("#app");

if (!container) {
  throw new Error("Missing app root for options page.");
}

createRoot(container).render(<App />);
