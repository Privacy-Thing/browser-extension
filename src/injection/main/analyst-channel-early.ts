// Imported first by the early MAIN bundles so the endpoint opens before they install.
import { openAnalystChannel } from "@/injection/main/analyst-channel";

// The Inspector UI, and with it the live channel, ships only outside release builds.
if (__PT_BUILD_CHANNEL__ !== "release")
  openAnalystChannel(__PT_ANALYST_HANDOFF_EARLY__);
