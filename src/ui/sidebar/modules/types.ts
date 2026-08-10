import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import type { ComponentType } from "react";

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
}

export interface SidebarModule {
  id: string;
  title: string;
  Component: ComponentType<SidebarModuleContext>;
}
