import type { SidebarModule } from "./types";
import { XRayModule } from "./xray/XRayModule";

import { t } from "@/ui/i18n";

export const SIDEBAR_MODULES: SidebarModule[] = [
  {
    id: "xray",
    get title() {
      return t.sidebar.xRayTitle;
    },
    Component: XRayModule,
  },
];
