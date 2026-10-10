import { registerFeatureUi } from "./feature-presentations";

import { controlDFeatureUi } from "@/experimental/control-d/ui-entry";

/** Composition root; product hosts only consume registered plugin presentations. */
if (controlDFeatureUi) registerFeatureUi("control-d", controlDFeatureUi);
