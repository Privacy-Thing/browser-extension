// Imported first by the full MAIN runtime so the endpoint opens before it installs.
import { openAnalystChannel } from "@/injection/main/analyst-channel";

openAnalystChannel(__PT_ANALYST_HANDOFF_RUNTIME__);
