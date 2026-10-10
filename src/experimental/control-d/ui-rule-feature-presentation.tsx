import type { ReactNode } from "react";

import { controlDRuleFeatureCopy } from "./ui-rule-feature-copy";
import { explanationCopy } from "./ui-rule-feature-explanation-copy";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import type { PluginFeatureUi } from "@/ui/plugins/feature-presentations";

const interpolate = (text: string, terms: Record<string, ReactNode>): ReactNode =>
  text.split(/(\{[a-z]+\})/).map((part, index) => {
    const name = part.slice(1, -1);
    return part.startsWith("{") && name in terms ? (
      <span key={index}>{terms[name]}</span>
    ) : (
      part
    );
  });

type PresentationContext = Parameters<PluginFeatureUi["renderExplanation"]>[0];
const SyncNotice = ({
  state,
  locale,
  openSettings,
}: Pick<PresentationContext, "state" | "locale" | "openSettings">) => {
  const copy = explanationCopy[locale];
  const sync = state.syncContext;
  const status = sync?.state ?? "ready";
  const message = status === "no-preset" ? copy.noPreset : copy[status];
  const path =
    sync?.settingsPath ?? "src/ui/options/index.html#page-experimental-integration";
  const href =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL(path)
      : `/${path}`;
  return (
    <p data-plugin-sync-context={status} className="text-xs text-muted-foreground">
      {status === "ready" ? (
        <>{interpolate(copy.fallback, { term: <em>{copy.customRules}</em> })} </>
      ) : null}
      {interpolate(message, { preset: sync?.presetName ?? copy.preset })}
      <a
        onClick={openSettings}
        data-plugin-settings-link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {status === "paused" ? copy.settings : copy.routes}
      </a>
      .
    </p>
  );
};

export const controlDFeatureUi: PluginFeatureUi = {
  messages: controlDRuleFeatureCopy,
  renderStatus: ({ state, locale, openSettings }) => {
    if (!state.syncContext || state.syncContext.state === "ready") return null;
    return (
      <SyncNotice
        state={state}
        locale={locale}
        {...(openSettings ? { openSettings } : {})}
      />
    );
  },
  renderExplanation: ({ feature, state, locale, openSettings }) => {
    const copy = explanationCopy[locale];
    const term = (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-plugin-feature-term
              className="italic underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.serviceRules}
            </button>
          </TooltipTrigger>
          <TooltipContent data-plugin-feature-tooltip className="max-w-sm">
            {copy.tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    return (
      <>
        <p>
          {interpolate(copy.scope, {
            term,
            feature: feature.name,
            service: <em>{copy.service}</em>,
          })}
        </p>
        <SyncNotice
          state={state}
          locale={locale}
          {...(openSettings ? { openSettings } : {})}
        />
      </>
    );
  },
};
