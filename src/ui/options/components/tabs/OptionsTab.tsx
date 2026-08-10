import type { SpoofingBrowserTarget } from "@/shared/spoofing-surfaces";
import { TabsContent } from "@/ui/components/ui/tabs";
import { GeoSettingsDialog } from "@/ui/options/components/modals/GeolocationAdvancedSettingsDialog";
import { useOptionsModel } from "@/ui/options/components/tabs/options-model";
import {
  AppearanceSection,
  OptionsSidebar,
  PrivacySection,
} from "@/ui/options/components/tabs/options-preference-sections";
import { SpoofingSection } from "@/ui/options/components/tabs/options-spoofing-section";
import { PAGE_ANCHORS } from "@/ui/options/navigation";

export { buildSpoofingSurfaces } from "@/ui/options/components/tabs/options-surface-data";

export const OptionsTab = ({
  browserTarget,
}: {
  browserTarget?: SpoofingBrowserTarget;
} = {}) => {
  const model = useOptionsModel(browserTarget);
  return (
    <TabsContent value="options" data-panel="options" id={PAGE_ANCHORS.options}>
      <GeoSettingsDialog
        open={model.geoDialogOpen}
        onOpenChange={model.setGeoDialogOpen}
      />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 flex flex-col gap-5 lg:col-span-8">
          <SpoofingSection model={model} />
          <PrivacySection model={model} />
          <AppearanceSection model={model} />
        </div>
        <OptionsSidebar model={model} />
      </div>
    </TabsContent>
  );
};
