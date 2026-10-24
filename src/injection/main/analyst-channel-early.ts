// Imported first by the early MAIN bundles so the endpoint opens before they install.
import { openAnalystChannel } from "@/injection/main/analyst-channel";

openAnalystChannel(__PT_ANALYST_HANDOFF_EARLY__);
