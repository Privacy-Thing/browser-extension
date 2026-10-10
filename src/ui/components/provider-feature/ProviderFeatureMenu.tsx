import { useId, useMemo, useState } from "react";

import { findProviderFeature, type JoinInfo, type ProviderFeature } from "./model";
import type { ProviderFeatureMessages } from "./provider-feature-copy";

import { Button } from "@/ui/components/ui/button";
import { Combobox } from "@/ui/components/ui/combobox";

type MenuProps = {
  copy: ProviderFeatureMessages;
  providerName: string;
  serviceLabel: string;
  sharedHosts: readonly string[];
  features: readonly ProviderFeature[];
  mode: "linked" | "staged" | "manual";
  joinFor: (featureId: string) => JoinInfo | null;
  onChoose: (feature: ProviderFeature) => void;
  onDetach: () => void;
  onClear: () => void;
  onDone: () => void;
};

const menuItemClass =
  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-accent focus:bg-accent focus-visible:outline-none focus-visible:ring-0";

const Catalogue = ({
  copy,
  providerName,
  features,
  onChoose,
  onDone,
  onBack,
}: MenuProps & { onBack: (() => void) | null }) => {
  const labelId = useId();
  const [draftId, setDraftId] = useState("");
  const options = useMemo(
    () =>
      features.map((feature) => ({ value: feature.featureId, label: feature.name })),
    [features],
  );
  return (
    <div data-provider-feature-chooser className="space-y-2">
      <span id={labelId} className="block text-xs font-medium text-muted-foreground">
        {copy.pickerLabel(providerName)}
      </span>
      <Combobox
        options={options}
        value={draftId}
        onValueChange={(featureId) => {
          const feature = findProviderFeature(features, featureId);
          if (!feature) return;
          setDraftId(featureId);
          onChoose(feature);
          onDone();
        }}
        placeholder={copy.pickerPlaceholder}
        searchPlaceholder={copy.pickerSearch}
        emptyMessage={copy.pickerEmpty}
        size="sm"
        aria-labelledby={labelId}
      />
      <div className="flex gap-1.5">
        {onBack ? (
          <Button type="button" size="sm" variant="ghost" onClick={onBack}>
            {copy.back}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

const MenuActions = ({
  copy,
  mode,
  sharedHosts,
  serviceLabel,
  providerName,
  onDetach,
  onClear,
  onDone,
  onChange,
}: MenuProps & { onChange: () => void }) => {
  const caption = copy.sharedWith(sharedHosts);
  return (
    <div
      data-provider-feature-menu
      role="menu"
      aria-label={copy.menuHeader(serviceLabel, providerName)}
      className="flex flex-col items-stretch gap-0.5"
    >
      <p className="px-2 py-1 text-xs text-muted-foreground">
        {copy.menuHeader(serviceLabel, providerName)}
      </p>
      {caption ? (
        <p
          data-provider-feature-shared
          className="px-2 pb-1 text-xs text-muted-foreground"
        >
          {caption}
        </p>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className={menuItemClass}
        data-provider-feature-action="change"
        onClick={onChange}
      >
        {copy.change}
      </button>
      {mode === "linked" ? (
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClass} text-destructive focus:bg-destructive/10 focus:text-destructive`}
          data-provider-feature-action="detach"
          onClick={() => {
            onDetach();
            onDone();
          }}
        >
          {copy.removeService}
        </button>
      ) : (
        <button
          type="button"
          role="menuitem"
          className={menuItemClass}
          data-provider-feature-action="clear"
          onClick={() => {
            onClear();
            onDone();
          }}
        >
          {copy.dontUse}
        </button>
      )}
    </div>
  );
};

export const ProviderFeatureMenu = (props: MenuProps) => {
  const [choosing, setChoosing] = useState(props.mode === "manual");
  if (choosing) {
    return (
      <Catalogue
        {...props}
        onBack={props.mode === "manual" ? null : () => setChoosing(false)}
      />
    );
  }
  return <MenuActions {...props} onChange={() => setChoosing(true)} />;
};
