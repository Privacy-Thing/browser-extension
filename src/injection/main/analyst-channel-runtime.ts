// Imported first by the full MAIN runtime so the endpoint opens before it installs.
import { openAnalystChannel } from "@/injection/main/analyst-channel";

// The Inspector UI, and with it the live channel, ships only outside release builds.
if (__PT_BUILD_CHANNEL__ !== "release")
  openAnalystChannel(__PT_ANALYST_HANDOFF_RUNTIME__);
