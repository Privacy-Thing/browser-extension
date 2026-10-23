import "@/ui/styles/globals.css";
import "./troubleshooter.css";

import { createRoot } from "react-dom/client";

import { WorkerTestWindow } from "./WorkerTestWindow";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { LocaleRefresh } from "@/ui/i18n/LocaleRefresh";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

document.title = BRAND_DISPLAY_NAME;

const App = () => (
  <ThemeProvider>
    <LocaleRefresh>
      <WorkerTestWindow />
    </LocaleRefresh>
  </ThemeProvider>
);

const container = document.querySelector("#app");
if (!container) throw new Error("Missing app root for troubleshooter.");
createRoot(container).render(<App />);
