import { useId, useRef, useState } from "react";

import { BUILD_CHANNEL } from "@/shared/build-flags";
import { compileDomainPattern, getDomainPatternKind } from "@/shared/domain-match";
import { FEATURE_COMMANDS } from "@/shared/provider-feature";
import {
  ProviderFeaturePanel,
  type ProviderFeatureVariant,
} from "@/ui/components/provider-feature";
import { Input } from "@/ui/components/ui/input";
import { t } from "@/ui/i18n";
import {
  toFeatureSyncStatus,
  useProviderFeature,
} from "@/ui/shared/use-provider-feature";

export type ProviderFeatureHostProps = {
  /** Pattern of the saved rule; drafts must not reach the provider. */
  rulePattern: string;
  /** Fixed representative host, such as the popup's current tab. */
  hostname?: string | null | undefined;
  variant?: ProviderFeatureVariant;
};

const normalizeHost = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "");

export const isRepresentativeHost = (pattern: string, hostname: string): boolean =>
  /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname) &&
  compileDomainPattern(pattern).test(hostname);

/** Broad patterns only get a host the user types; `*.x` and wildcards are never guessed. */
const initialHost = (pattern: string, fixed: string | null): string => {
  if (fixed !== null) return fixed;
  const kind = getDomainPatternKind(pattern);
  if (kind === "exact") return pattern;
  if (kind === "apex-and-subdomains") return pattern.slice(1);
  return "";
};

type HostFieldProps = {
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

const RepresentativeHostField = ({
  value,
  invalid,
  disabled,
  onChange,
  onCommit,
  inputRef,
}: HostFieldProps) => {
  const inputId = useId();
  const hintId = useId();
  return (
    <div data-provider-feature-host-field className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {t.rules.inspector.hostnameLabel}
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        value={value}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder={t.rules.inspector.hostnamePlaceholder}
        aria-describedby={hintId}
        aria-invalid={invalid}
        disabled={disabled}
        className="aria-invalid:border-destructive"
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onCommit();
        }}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        {t.rules.inspector.hostnameHint}
      </p>
    </div>
  );
};

const ProviderFeatureHostBody = ({
  rulePattern,
  hostname: fixedHostname,
  variant = "default",
}: ProviderFeatureHostProps) => {
  const fixed = fixedHostname ? normalizeHost(fixedHostname) : null;
  const [draft, setDraft] = useState(() => initialHost(rulePattern, fixed));
  const [committed, setCommitted] = useState(() => {
    const host = normalizeHost(initialHost(rulePattern, fixed));
    return isRepresentativeHost(rulePattern, host) ? host : "";
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hostname = fixed ?? committed;
  const { state, busy, error, send } = useProviderFeature(rulePattern, hostname);
  const draftHost = normalizeHost(draft);
  const draftValid = isRepresentativeHost(rulePattern, draftHost);

  if (state === null || (!state.available && state.binding === null)) return null;

  const commit = () => {
    if (draftValid) setCommitted(draftHost);
  };
  const showField = fixed === null && getDomainPatternKind(rulePattern) !== "exact";

  return (
    <div data-provider-feature-host className="space-y-2">
      {showField ? (
        <RepresentativeHostField
          value={draft}
          invalid={draft.trim() !== "" && !draftValid}
          disabled={busy}
          onChange={setDraft}
          onCommit={commit}
          inputRef={inputRef}
        />
      ) : null}
      <ProviderFeaturePanel
        variant={variant}
        providerName={state.providerName}
        hostname={hostname || draftHost || rulePattern}
        rulePattern={rulePattern}
        features={state.features}
        match={state.match}
        binding={state.binding}
        busy={busy}
        dismissed={state.dismissed}
        syncStatus={toFeatureSyncStatus(state.syncStatus)}
        onRecognize={() => {
          if (!hostname) {
            inputRef.current?.focus();
            return;
          }
          send(FEATURE_COMMANDS.recognize);
        }}
        onConfirm={(feature) => send(FEATURE_COMMANDS.confirm, feature.featureId)}
        onDismiss={() => send(FEATURE_COMMANDS.dismiss)}
        onDetach={() => send(FEATURE_COMMANDS.detach)}
      />
      {(error ?? state.error) ? (
        <p
          role="alert"
          data-provider-feature-error
          className="text-xs text-tone-error-text [overflow-wrap:anywhere]"
        >
          {error ?? state.error}
        </p>
      ) : null}
    </div>
  );
};

/** Provider feature panel for one saved rule source; absent from release builds. */
export const ProviderFeatureHost = (props: ProviderFeatureHostProps) =>
  BUILD_CHANNEL === "release" ? null : (
    <ProviderFeatureHostBody key={props.rulePattern} {...props} />
  );
