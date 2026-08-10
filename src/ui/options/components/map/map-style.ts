import type { StyleSpecification } from "maplibre-gl";

const cloneStyle = (style: StyleSpecification): StyleSpecification =>
  JSON.parse(JSON.stringify(style)) as StyleSpecification;

const getBundledSpriteUrl = (): string =>
  chrome.runtime.getURL("map-styles/openfreemap-sprite/ofm");

const normalizeFontName = (fontName: string): string => {
  if (!fontName.startsWith("Metropolis")) {
    return fontName;
  }

  if (fontName.includes("Italic")) {
    return "Noto Sans Italic";
  }

  if (fontName.includes("Bold")) {
    return "Noto Sans Bold";
  }

  return "Noto Sans Regular";
};

const normalizeStyleFonts = (style: StyleSpecification): StyleSpecification => {
  for (const layer of style.layers ?? []) {
    if (!("layout" in layer) || !layer.layout) {
      continue;
    }

    const layout = layer.layout as Record<string, unknown>;
    const textFont = layout["text-font"];
    if (!Array.isArray(textFont)) {
      continue;
    }

    const normalizedFonts = textFont
      .map((font) => (typeof font === "string" ? normalizeFontName(font) : null))
      .filter((font): font is string => font !== null);

    layout["text-font"] =
      normalizedFonts.length > 0 ? [normalizedFonts[0]] : ["Noto Sans Regular"];
  }

  return style;
};

const parseColorAlpha = (
  value: string,
  prefix: string,
  alphaPrefix: string,
): number | undefined => {
  const lowerValue = value.toLowerCase();
  if (!lowerValue.startsWith(prefix) && !lowerValue.startsWith(alphaPrefix)) {
    return undefined;
  }

  const openParenIndex = value.indexOf("(");
  const closeParenIndex = value.lastIndexOf(")");
  if (openParenIndex < 0 || closeParenIndex <= openParenIndex) {
    return undefined;
  }

  const parts = value
    .slice(openParenIndex + 1, closeParenIndex)
    .split(",")
    .map((part) => Number.parseFloat(part.trim()));

  if (parts.length === 4 && Number.isFinite(parts[3])) {
    return parts[3];
  }

  return parts.length === 3 ? 1 : undefined;
};

const extractColorAlpha = (value: unknown): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return (
    parseColorAlpha(value, "rgb(", "rgba(") ?? parseColorAlpha(value, "hsl(", "hsla(")
  );
};

const getLightSymbolLayout = (
  layer: StyleSpecification["layers"][number],
): Record<string, unknown> | null => {
  if (layer.type !== "symbol" || !("layout" in layer) || !layer.layout) {
    return null;
  }

  const layout = layer.layout as Record<string, unknown>;
  return layout["text-field"] === undefined ? null : layout;
};

const getDarkLayerLayout = (
  darkLayer: StyleSpecification["layers"][number] | undefined,
): Record<string, unknown> | null => {
  if (!darkLayer || !("layout" in darkLayer) || !darkLayer.layout) {
    return null;
  }

  return darkLayer.layout as Record<string, unknown>;
};

const syncLightTextOpacity = (
  lightLayer: StyleSpecification["layers"][number],
  darkLayer: StyleSpecification["layers"][number] | undefined,
): void => {
  if (!darkLayer || !("paint" in darkLayer) || !darkLayer.paint) {
    return;
  }

  if (!("paint" in lightLayer) || !lightLayer.paint) {
    lightLayer.paint = {};
  }

  const lightPaint = lightLayer.paint as Record<string, unknown>;
  const darkPaint = darkLayer.paint as Record<string, unknown>;
  if (darkPaint["text-opacity"] !== undefined) {
    lightPaint["text-opacity"] = darkPaint["text-opacity"];
    return;
  }

  const alpha = extractColorAlpha(darkPaint["text-color"]);
  if (alpha !== undefined) {
    lightPaint["text-opacity"] = alpha;
  }
};

const syncLightLabelSettings = (
  style: StyleSpecification,
  darkMatterStyle: StyleSpecification,
): StyleSpecification => {
  const darkLayersById = new Map(
    darkMatterStyle.layers.map((layer) => [layer.id, layer]),
  );

  for (const layer of style.layers ?? []) {
    const layout = getLightSymbolLayout(layer);
    if (!layout) {
      continue;
    }

    const darkLayer = darkLayersById.get(layer.id);
    const darkLayout = getDarkLayerLayout(darkLayer);
    if (!darkLayout) {
      continue;
    }

    if (darkLayout["text-size"] !== undefined) {
      layout["text-size"] = darkLayout["text-size"];
    }

    syncLightTextOpacity(layer, darkLayer);
  }

  return style;
};

const normalizePaintAssets = (style: StyleSpecification): StyleSpecification => {
  for (const layer of style.layers ?? []) {
    if (!("paint" in layer) || !layer.paint) {
      continue;
    }

    const paint = layer.paint as Record<string, unknown>;
    if (paint["fill-pattern"] === "wood-pattern") {
      delete paint["fill-pattern"];
    }
  }

  return style;
};

const hideUndergroundLayers = (style: StyleSpecification): StyleSpecification => {
  for (const layer of style.layers ?? []) {
    if (!layer.id.startsWith("tunnel_")) {
      continue;
    }

    if (!("layout" in layer) || !layer.layout) {
      layer.layout = { visibility: "none" };
      continue;
    }

    const layout = layer.layout as Record<string, unknown>;
    layout.visibility = "none";
  }

  return style;
};

const normalizeArrowRotations = (style: StyleSpecification): StyleSpecification => {
  for (const layer of style.layers ?? []) {
    if (
      !("layout" in layer) ||
      !layer.layout ||
      (layer.id !== "road_oneway" && layer.id !== "road_oneway_opposite")
    ) {
      continue;
    }

    const layout = layer.layout as Record<string, unknown>;
    layout["icon-rotate"] = layer.id === "road_oneway" ? 90 : 270;
  }

  return style;
};

const darkenLightRoadLabels = (style: StyleSpecification): StyleSpecification => {
  const roadLabelColors = new Map<string, string>([
    ["highway_name_other", "#6b7280"],
    ["highway_name_motorway", "#5f6b7a"],
  ]);

  for (const layer of style.layers ?? []) {
    const nextColor = roadLabelColors.get(layer.id);
    if (!nextColor || !("paint" in layer)) {
      continue;
    }

    if (!layer.paint) {
      layer.paint = {};
    }

    const paint = layer.paint as Record<string, unknown>;
    paint["text-color"] = nextColor;
  }

  return style;
};

export const buildMapStyle = (theme: "light" | "dark"): StyleSpecification => {
  throw new Error(
    `buildMapStyle is sync-only legacy API and cannot load ${theme} style.`,
  );
};

const normalizeMapStyle = (
  rawStyle: StyleSpecification,
  theme: "light" | "dark",
  darkMatterStyle?: StyleSpecification,
): StyleSpecification => {
  let style = normalizeArrowRotations(
    hideUndergroundLayers(
      normalizePaintAssets(
        normalizeStyleFonts(cloneStyle(rawStyle as StyleSpecification)),
      ),
    ),
  );
  if (theme === "light") {
    if (!darkMatterStyle) {
      throw new Error("Missing dark map style dependency for light theme labels.");
    }
    style = darkenLightRoadLabels(syncLightLabelSettings(style, darkMatterStyle));
  }
  style.sprite = getBundledSpriteUrl();
  return style;
};

export const loadMapStyle = async (
  theme: "light" | "dark",
): Promise<StyleSpecification> => {
  if (theme === "dark") {
    const { default: darkMatterStyleJson } =
      await import("@/ui/options/components/map/styles/dark-matter.json");
    return normalizeMapStyle(darkMatterStyleJson as StyleSpecification, "dark");
  }

  const [{ default: positronStyleJson }, { default: darkMatterStyleJson }] =
    await Promise.all([
      import("@/ui/options/components/map/styles/positron.json"),
      import("@/ui/options/components/map/styles/dark-matter.json"),
    ]);

  return normalizeMapStyle(
    positronStyleJson as StyleSpecification,
    "light",
    darkMatterStyleJson as StyleSpecification,
  );
};
