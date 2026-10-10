import { useState, type ReactNode } from "react";

import { ruleGroupCopy } from "./rule-group-copy";

import { getRuleGroupPatterns } from "@/shared/rule-groups";
import type { DomainRule } from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { useUiLocale } from "@/ui/i18n/LocaleRefresh";

/** Product-owned scope. Provider badges describe only external features. */
export const RuleHostList = ({ patterns }: { patterns: readonly string[] }) => {
  const copy = ruleGroupCopy[useUiLocale()];
  if (patterns.length < 2) return null;
  return (
    <section data-rule-hosts className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{copy.patterns}</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {patterns.map((pattern) => (
          <li key={pattern} data-rule-host={pattern} className="break-all">
            <code>{pattern}</code>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{copy.hint}</p>
    </section>
  );
};

export const RuleAdditionalHosts = ({
  rules,
  sourcePattern,
  renderPrimary,
}: {
  rules: readonly DomainRule[];
  sourcePattern: string | null;
  renderPrimary: (addControl: ReactNode) => ReactNode;
}) => {
  const copy = ruleGroupCopy[useUiLocale()];
  const [entries, setEntries] = useState(() =>
    (sourcePattern ? getRuleGroupPatterns(rules, sourcePattern) : [])
      .filter((pattern) => pattern !== sourcePattern)
      .map((pattern) => ({ id: crypto.randomUUID(), pattern })),
  );
  const addControl = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      data-rule-host-action="add"
      aria-label={copy.addPattern}
      title={copy.addPattern}
      onClick={() =>
        setEntries((current) => [...current, { id: crypto.randomUUID(), pattern: "" }])
      }
    >
      <span aria-hidden="true" className="text-xl leading-none">
        +
      </span>
    </Button>
  );
  return (
    <div data-rule-additional-hosts className="space-y-2">
      {renderPrimary(entries.length === 0 ? addControl : null)}
      {entries.length > 0 ? (
        <>
          <p className="pt-3 text-sm font-medium text-foreground">
            {copy.additionalPatterns}
          </p>
          <p className="text-xs text-muted-foreground">{copy.hint}</p>
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              data-rule-pattern-row
              className="flex min-w-0 items-center gap-2"
            >
              <Input
                className="min-w-0 flex-1"
                name="additionalRulePatterns"
                data-rule-host-input
                aria-label={copy.patternLabel(index + 2)}
                value={entry.pattern}
                onChange={(event) => {
                  const pattern = event.currentTarget.value;
                  setEntries((current) =>
                    current.map((item) =>
                      item.id === entry.id ? { ...item, pattern } : item,
                    ),
                  );
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                data-rule-host-action="remove"
                aria-label={`${copy.removePattern}: ${entry.pattern || copy.patternLabel(index + 2)}`}
                onClick={() =>
                  setEntries((current) =>
                    current.filter((item) => item.id !== entry.id),
                  )
                }
              >
                <span aria-hidden="true">×</span>
              </Button>
              {index === entries.length - 1 ? addControl : null}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
};
