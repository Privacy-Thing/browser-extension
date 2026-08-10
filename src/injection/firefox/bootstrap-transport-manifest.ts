import type {
  FxBootstrapInfo,
  FxBootstrapSource,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

export type FxTransportScope = "bootstrap-source" | "carrier-only";

export type FxTransportConfig = FxBootstrapInfo & {
  description: string;
  precedence: number | null;
  selectionScope: FxTransportScope;
};

export const FX_TRANSPORT_ORDER = [
  "hash",
  "static",
  "windowName",
  "userScript",
  "ephemeral",
] as const satisfies readonly FxBootstrapSource[];

const FX_TRANSPORT_BY_SOURCE = {
  hash: {
    source: "hash",
    role: "authoritative-early-seed",
    status: "main",
    visibility: "visible",
    needsOptionalPermission: false,
    description:
      "URL hash seed used for the current navigation's first-inline bootstrap.",
    precedence: 0,
    selectionScope: "bootstrap-source",
  },
  windowName: {
    source: "windowName",
    role: "authoritative-early-seed",
    status: "backup",
    visibility: "hidden",
    needsOptionalPermission: false,
    description: "window.name seed used as the hidden preload/backstop transport.",
    precedence: 2,
    selectionScope: "bootstrap-source",
  },
  static: {
    source: "static",
    role: "authoritative-early-seed",
    status: "backup",
    visibility: "hidden",
    needsOptionalPermission: false,
    description: "Embedded host payload injected into the registered geo-shim bundle.",
    precedence: 1,
    selectionScope: "bootstrap-source",
  },
  userScript: {
    source: "userScript",
    role: "authoritative-early-seed",
    status: "backup",
    visibility: "hidden",
    needsOptionalPermission: true,
    description:
      "Firefox userScripts registration path that carries the static geo-shim artifact.",
    precedence: null,
    selectionScope: "carrier-only",
  },
  ephemeral: {
    source: "ephemeral",
    role: "late-convergence",
    status: "late-closure",
    visibility: "hidden",
    needsOptionalPermission: false,
    description: "Ephemeral DOM seed and CustomEvent transport for late convergence.",
    precedence: 3,
    selectionScope: "bootstrap-source",
  },
} as const satisfies Record<FxBootstrapSource, FxTransportConfig>;

export const FX_TRANSPORTS = FX_TRANSPORT_ORDER.map(
  (source) => FX_TRANSPORT_BY_SOURCE[source],
);

export const FX_SOURCE_ORDER = FX_TRANSPORTS.filter(
  ({ selectionScope }) => selectionScope === "bootstrap-source",
)
  .sort(
    (left, right) =>
      (left.precedence ?? Number.POSITIVE_INFINITY) -
      (right.precedence ?? Number.POSITIVE_INFINITY),
  )
  .map(({ source }) => source);

export const getFxTransportInfo = (source: FxBootstrapSource): FxTransportConfig =>
  FX_TRANSPORT_BY_SOURCE[source];
