import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import type { ComponentType } from "react";

import type { InspectorApi } from "./xray/inspector/inspector-api";

import type { SpoofingBrowserTarget } from "@/shared/spoofing-surfaces";

export interface SidebarModuleContext {
  tabId: number | undefined;
  xRayState: GetXRayStateResponse | null;
  xRayLoading: boolean;
  /** True while awaiting the initial surface-usage dump from the page world. */
  xRaySurfaceSyncPending: boolean;
  refreshXRayState: () => void;
  /** Effective location ID resolved for the active tab — for deep-linking to the location editor. */
  locationId: string | null;
  /** Optional shell integration used by isolated renderers such as Storybook. */
  onOpenLocation?: (locationId: string) => void;
  /** Inspector backend override; the sidebar talks to the background by default. */
  xRayInspectorApi?: InspectorApi;
  /** Browser whose DevTools hints to show; defaults to the build target. */
  browserTarget?: SpoofingBrowserTarget;
}

export interface SidebarModule {
  id: string;
  title: string;
  Component: ComponentType<SidebarModuleContext>;
}
