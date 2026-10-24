import { installAnalystEndpoints } from "@/content/analyst-endpoints";

// The Inspector UI, and with it the live channel, ships only outside release builds.
if (__PT_BUILD_CHANNEL__ !== "release") installAnalystEndpoints();
