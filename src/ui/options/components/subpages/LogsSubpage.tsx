import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import { fireAndForget } from "@/shared/async";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ClearLogsResponse,
  ExtensionLogEntry,
  GetLogsResponse,
} from "@/shared/types";
import { ExtensionLogLevel, getLogLevelsAtOrAbove, LogCategory } from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import type { CheckboxOption } from "@/ui/components/ui/checkbox-group";
import { CheckboxGroup } from "@/ui/components/ui/checkbox-group";
import { Input } from "@/ui/components/ui/input";
import { notify } from "@/ui/components/ui/toast";
import { PAGE_ANCHORS } from "@/ui/options/navigation";
import { AppSubpageHeader } from "@/ui/shared/AppSubpageHeader";
import { sendRuntimeMessage } from "@/ui/shared/runtime-messaging";

const formatTime = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

const LEVEL_LABELS: Record<ExtensionLogLevel, string> = {
  [ExtensionLogLevel.Verbose]: "Verbose",
  [ExtensionLogLevel.Info]: "Info",
  [ExtensionLogLevel.Warn]: "Warning",
  [ExtensionLogLevel.Error]: "Error",
};

const createSelectedLevels = (): Set<ExtensionLogLevel> =>
  new Set(getLogLevelsAtOrAbove(ExtensionLogLevel.Info));

const serializeLogs = (entries: ExtensionLogEntry[]): string =>
  JSON.stringify(entries, null, 2);

const formatJsonValue = (value: unknown): string => {
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type RuntimeLogDetails = {
  component?: string;
  method?: string;
  kind?: string;
  message?: string;
  stack?: string;
  args?: unknown;
  result?: unknown;
};

const getRuntimeLogDetails = (
  details: ExtensionLogEntry["details"],
): RuntimeLogDetails | null => {
  if (!isRecord(details)) {
    return null;
  }

  const runtimeKeys = [
    "args",
    "result",
    "stack",
    "message",
    "component",
    "method",
    "kind",
  ];
  if (!runtimeKeys.some((key) => key in details)) {
    return null;
  }

  return {
    ...(typeof details.component === "string" ? { component: details.component } : {}),
    ...(typeof details.method === "string" ? { method: details.method } : {}),
    ...(typeof details.kind === "string" ? { kind: details.kind } : {}),
    ...(typeof details.message === "string" ? { message: details.message } : {}),
    ...(typeof details.stack === "string" ? { stack: details.stack } : {}),
    ...("args" in details ? { args: details.args } : {}),
    ...("result" in details ? { result: details.result } : {}),
  };
};

const copyTextToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error("Clipboard copy failed");
    }
  }
};

const useLogEntries = () => {
  const [logs, setLogs] = useState<ExtensionLogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLogs = async ({
    notifyOnError = false,
  }: { notifyOnError?: boolean } = {}) => {
    setIsRefreshing(true);
    try {
      const response = await sendRuntimeMessage<GetLogsResponse>({
        type: EXTENSION_COMMAND_TYPES.getLogs,
      });
      setLogs(response?.logs || []);
    } catch (error) {
      console.error("Failed to load logs", error);
      if (notifyOnError) {
        notify.error("Failed to refresh logs.", {
          description: "Try again in a moment.",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadLogs();
    const handleFocus = () => void loadLogs();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const clearLogs = async (): Promise<void> => {
    await sendRuntimeMessage<ClearLogsResponse>({
      type: EXTENSION_COMMAND_TYPES.clearLogs,
    } satisfies { type: typeof EXTENSION_COMMAND_TYPES.clearLogs });
    setLogs([]);
  };

  return { clearLogs, isRefreshing, loadLogs, logs };
};

const useLogFilters = (
  logs: ExtensionLogEntry[],
  initialHostFilter?: string | null,
) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(() =>
    initialHostFilter ? new Set([initialHostFilter]) : new Set(),
  );
  const [selectedLevels, setSelectedLevels] =
    useState<Set<ExtensionLogLevel>>(createSelectedLevels);

  const levelOptions = useMemo<CheckboxOption[]>(
    () =>
      Object.values(ExtensionLogLevel).map((level) => ({
        id: level,
        label: LEVEL_LABELS[level],
      })),
    [],
  );
  const domainOptions = useMemo(() => {
    const domains = new Set<string>();
    logs.forEach((log) => {
      if (log.hostname) domains.add(log.hostname);
    });
    return Array.from(domains)
      .sort()
      .map((domain) => ({ id: domain, label: domain }));
  }, [logs]);
  const categoryGroups = useMemo(() => {
    const groups: Partial<Record<LogCategory, Set<string>>> = {};
    logs.forEach((log) => {
      groups[log.category] ??= new Set();
      groups[log.category]?.add(log.event);
    });

    return Object.values(LogCategory).flatMap((category) => {
      const events = groups[category];
      return events && events.size > 0
        ? [
            {
              category,
              options: Array.from(events)
                .sort()
                .map((event) => ({ id: `${category}::${event}`, label: event })),
            },
          ]
        : [];
    });
  }, [logs]);
  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      const eventId = `${entry.category}::${entry.event}`;
      const haystack = [
        entry.category,
        entry.level,
        entry.event,
        entry.hostname ?? "",
        entry.tabId?.toString() ?? "",
        JSON.stringify(entry.details ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return (
        (selectedLevels.size === 0 || selectedLevels.has(entry.level)) &&
        (selectedDomains.size === 0 ||
          Boolean(entry.hostname && selectedDomains.has(entry.hostname))) &&
        (selectedEvents.size === 0 || selectedEvents.has(eventId)) &&
        (!query || haystack.includes(query))
      );
    });
  }, [logs, searchQuery, selectedEvents, selectedDomains, selectedLevels]);

  const resetFilters = (): void => {
    setSelectedEvents(new Set());
    setSelectedDomains(new Set());
    setSelectedLevels(createSelectedLevels());
  };

  return {
    categoryGroups,
    domainOptions,
    filteredLogs,
    levelOptions,
    resetFilters,
    searchQuery,
    selectedDomains,
    selectedEvents,
    selectedLevels,
    setSearchQuery,
    setSelectedDomains,
    setSelectedEvents,
    setSelectedLevels,
  };
};

type LogFiltersProps = {
  categoryGroups: { category: LogCategory; options: CheckboxOption[] }[];
  domainOptions: CheckboxOption[];
  levelOptions: CheckboxOption[];
  searchQuery: string;
  selectedDomains: Set<string>;
  selectedEvents: Set<string>;
  selectedLevels: Set<ExtensionLogLevel>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedDomains: Dispatch<SetStateAction<Set<string>>>;
  setSelectedEvents: Dispatch<SetStateAction<Set<string>>>;
  setSelectedLevels: Dispatch<SetStateAction<Set<ExtensionLogLevel>>>;
};

const LogFilters = (props: LogFiltersProps) => (
  <aside className="top-6 flex flex-col gap-6">
    <div>
      <label htmlFor="search" className="mb-1.5 block text-sm font-medium">
        Search
      </label>
      <Input
        id="search"
        type="search"
        placeholder="category, hostname, event..."
        value={props.searchQuery}
        onChange={(event) => props.setSearchQuery(event.target.value)}
      />
    </div>
    <div className="border-t pt-2">
      <CheckboxGroup
        title="Levels"
        options={props.levelOptions}
        selectedKeys={props.selectedLevels}
        onSelectionChange={(keys) =>
          props.setSelectedLevels(new Set(keys as Set<ExtensionLogLevel>))
        }
      />
    </div>
    {props.domainOptions.length > 0 ? (
      <div className="border-t pt-2">
        <CheckboxGroup
          title="Domains"
          options={props.domainOptions}
          selectedKeys={props.selectedDomains}
          onSelectionChange={props.setSelectedDomains}
        />
      </div>
    ) : null}
    {props.categoryGroups.length > 0 ? (
      <div className="mt-2 flex flex-col gap-5 border-t pt-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Event Categories
        </h3>
        {props.categoryGroups.map((group) => (
          <CheckboxGroup
            key={group.category}
            title={group.category}
            options={group.options}
            selectedKeys={props.selectedEvents}
            onSelectionChange={props.setSelectedEvents}
          />
        ))}
      </div>
    ) : null}
  </aside>
);

const RuntimeDetailsView = ({
  details,
  entryId,
}: {
  details: RuntimeLogDetails;
  entryId?: string;
}) => {
  const metadata = [details.component, details.method, details.kind].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return (
    <div className="mt-1 flex flex-col gap-3">
      {details.message ? (
        <pre className="overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-xs text-secondary-foreground">
          {details.message}
        </pre>
      ) : null}
      {metadata.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {metadata.map((value, index) => (
            <span
              // eslint-disable-next-line react/no-array-index-key -- index is a tie-breaker for duplicate metadata values
              key={`${entryId ?? "log"}-${index}-${value}`}
            >
              {index > 0 ? <span className="mr-2">&bull;</span> : null}
              {value}
            </span>
          ))}
        </p>
      ) : null}
      {(["args", "result"] as const).map((field) =>
        field in details ? (
          <section key={field} className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {field === "args" ? "Arguments" : "Result"}
            </h4>
            <pre className="overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-xs text-secondary-foreground">
              {formatJsonValue(details[field])}
            </pre>
          </section>
        ) : null,
      )}
      {details.stack ? (
        <section className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stack
          </h4>
          <pre className="overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-xs whitespace-pre-wrap break-all text-secondary-foreground">
            {details.stack}
          </pre>
        </section>
      ) : null}
    </div>
  );
};

const LogDetails = ({ entry }: { entry: ExtensionLogEntry }) => {
  if (entry.details === undefined) return null;
  const details = getRuntimeLogDetails(entry.details);
  return details ? (
    <>
      <RuntimeDetailsView details={details} entryId={entry.id} />
      <details className="mt-3 rounded-lg bg-secondary/20 px-3 py-2 text-xs text-secondary-foreground">
        <summary className="cursor-pointer font-semibold uppercase tracking-wider text-muted-foreground">
          Raw details
        </summary>
        <pre className="mt-2 overflow-auto font-mono text-xs text-secondary-foreground">
          {formatJsonValue(entry.details)}
        </pre>
      </details>
    </>
  ) : (
    <pre className="mt-1 overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-xs text-secondary-foreground">
      {formatJsonValue(entry.details)}
    </pre>
  );
};

const LogCard = ({ entry }: { entry: ExtensionLogEntry }) => (
  <Card className="overflow-hidden">
    <CardHeader className="flex flex-row items-baseline justify-between gap-4 space-y-0 border-b bg-muted/30 px-4 py-3">
      <CardTitle className="max-w-full truncate text-[15px]">{entry.event}</CardTitle>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground">
          {LEVEL_LABELS[entry.level]}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          {entry.category}
        </span>
      </div>
    </CardHeader>
    <CardContent className="flex flex-col gap-2 px-4 py-3">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatTime(entry.time)}</span>
        {entry.hostname ? (
          <>
            <span>&bull;</span>
            <span>host: {entry.hostname}</span>
          </>
        ) : null}
        {typeof entry.tabId === "number" ? (
          <>
            <span>&bull;</span>
            <span>tab: {entry.tabId}</span>
          </>
        ) : null}
      </p>
      <LogDetails entry={entry} />
    </CardContent>
  </Card>
);

type LogActionsProps = {
  disabled: boolean;
  isRefreshing: boolean;
  clear: () => Promise<void>;
  copy: () => Promise<void>;
  refresh: () => Promise<void>;
  view: () => void;
};

const LogActions = (props: LogActionsProps) => (
  <>
    <Button
      variant="outline"
      size="sm"
      onClick={() => fireAndForget(props.refresh())}
      disabled={props.isRefreshing}
    >
      {props.isRefreshing ? "Refreshing..." : "Refresh"}
    </Button>
    <Button variant="outline" size="sm" onClick={props.view} disabled={props.disabled}>
      View raw
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => fireAndForget(props.copy())}
      disabled={props.disabled}
    >
      Copy to clipboard
    </Button>
    <Button variant="secondary" size="sm" onClick={() => fireAndForget(props.clear())}>
      Clear Logs
    </Button>
  </>
);

export const LogsSubpage = ({
  initialHostFilter,
}: {
  initialHostFilter?: string | null;
}) => {
  const entries = useLogEntries();
  const filters = useLogFilters(entries.logs, initialHostFilter);

  const rawFilteredLogs = useMemo(
    () => serializeLogs(filters.filteredLogs),
    [filters.filteredLogs],
  );

  const handleViewRaw = (): void => {
    if (filters.filteredLogs.length === 0) {
      return;
    }

    const rawUrl = URL.createObjectURL(
      new Blob([rawFilteredLogs], { type: "application/json;charset=utf-8" }),
    );
    const openedWindow = window.open(rawUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(rawUrl), 60_000);

    if (!openedWindow) {
      notify.error("Failed to open raw logs.", {
        description: "Your browser blocked the new tab.",
      });
    }
  };

  const handleCopyRaw = async (): Promise<void> => {
    if (filters.filteredLogs.length === 0) {
      return;
    }

    try {
      await copyTextToClipboard(rawFilteredLogs);
      notify.success("Copied raw logs to clipboard.");
    } catch {
      notify.error("Failed to copy raw logs.", {
        description: "Clipboard access was denied.",
      });
    }
  };

  const handleClearLogs = async (): Promise<void> => {
    await entries.clearLogs();
    filters.resetFilters();
  };

  return (
    <div className="flex flex-col gap-6">
      <AppSubpageHeader
        title="Logs"
        lead="Spy on captured background interactions and runtime method overrides."
        backLabel="Back"
        backAriaLabel="Back"
        backIconOnly
        backHref={`#${PAGE_ANCHORS.advanced}`}
        actions={
          <LogActions
            clear={handleClearLogs}
            copy={handleCopyRaw}
            disabled={filters.filteredLogs.length === 0}
            isRefreshing={entries.isRefreshing}
            refresh={() => entries.loadLogs({ notifyOnError: true })}
            view={handleViewRaw}
          />
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[260px_1fr]">
        <LogFilters {...filters} />

        <main className="min-w-0">
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-4 text-sm text-muted-foreground"
          >
            {filters.filteredLogs.length} visible of {entries.logs.length} collected
            entries
          </p>

          {filters.filteredLogs.length === 0 ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm italic text-muted-foreground"
            >
              No logs match the active filters.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filters.filteredLogs.map((entry, index) => (
                <LogCard key={entry.id ?? index} entry={entry} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
