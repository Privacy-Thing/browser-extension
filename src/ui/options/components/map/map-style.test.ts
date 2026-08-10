import { describe, expect, it, vi } from "vitest";

import { loadMapStyle } from "@/ui/options/components/map/map-style";

const withStubbedChrome = async <T>(callback: () => Promise<T> | T): Promise<T> => {
  vi.stubGlobal("chrome", {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
  });

  try {
    return await callback();
  } finally {
    vi.unstubAllGlobals();
  }
};

const getLayerPaintValue = (
  theme: "light" | "dark",
  layerId: string,
  property: string,
): Promise<unknown> =>
  withStubbedChrome(async () => {
    const style = await loadMapStyle(theme);
    const layer = style.layers.find((candidate) => candidate.id === layerId);
    if (!layer || !("paint" in layer) || !layer.paint) {
      return undefined;
    }

    return (layer.paint as Record<string, unknown>)[property];
  });

const getLayerLayoutValue = (
  theme: "light" | "dark",
  layerId: string,
  property: string,
): Promise<unknown> =>
  withStubbedChrome(async () => {
    const style = await loadMapStyle(theme);
    const layer = style.layers.find((candidate) => candidate.id === layerId);
    if (!layer || !("layout" in layer) || !layer.layout) {
      return undefined;
    }

    return (layer.layout as Record<string, unknown>)[property];
  });

describe("loadMapStyle", () => {
  it("replaces unsupported Metropolis font stacks with one supported Noto Sans font", async () => {
    await withStubbedChrome(async () => {
      const style = await loadMapStyle("light");
      const textFonts = style.layers.flatMap((layer) => {
        if (!("layout" in layer) || !layer.layout) {
          return [];
        }

        const textFont = (layer.layout as Record<string, unknown>)["text-font"];
        return Array.isArray(textFont)
          ? textFont.filter((font): font is string => typeof font === "string")
          : [];
      });

      expect(textFonts.some((font) => font.startsWith("Metropolis"))).toBe(false);
      expect(textFonts).toContain("Noto Sans Regular");
      expect(
        style.layers.every((layer) => {
          if (!("layout" in layer) || !layer.layout) {
            return true;
          }

          const textFont = (layer.layout as Record<string, unknown>)["text-font"];
          return !Array.isArray(textFont) || textFont.length <= 1;
        }),
      ).toBe(true);
      expect(style.sprite).toBe(
        "chrome-extension://test/map-styles/openfreemap-sprite/ofm",
      );
    });
  });

  it("removes unsupported sprite patterns from the dark map style", async () => {
    await withStubbedChrome(async () => {
      const style = await loadMapStyle("dark");
      const fillPatterns = style.layers.flatMap((layer) => {
        if (!("paint" in layer) || !layer.paint) {
          return [];
        }

        const fillPattern = (layer.paint as Record<string, unknown>)["fill-pattern"];
        return typeof fillPattern === "string" ? [fillPattern] : [];
      });

      expect(fillPatterns).not.toContain("wood-pattern");
    });
  });

  it("keeps the imported dark-matter base styling", async () => {
    await withStubbedChrome(async () => {
      expect(await getLayerPaintValue("dark", "highway_path", "line-color")).toBe(
        "rgba(18, 18, 18, 1)",
      );
      expect(
        await getLayerPaintValue("dark", "highway_major_casing", "line-color"),
      ).toBe("rgba(60, 60, 60, 0.95)");
      expect(
        await getLayerPaintValue("dark", "landuse_residential", "fill-color"),
      ).toBe("rgba(18, 18, 18, 1)");
      expect(await getLayerPaintValue("dark", "building", "fill-color")).toBe(
        "rgba(35, 34, 34, 1)",
      );
      expect(await getLayerPaintValue("dark", "highway_name_other", "text-color")).toBe(
        "rgba(255, 255, 255, 1)",
      );
    });
  });

  it("copies dark-matter label sizing and opacity into the light style", async () => {
    await withStubbedChrome(async () => {
      expect(
        await getLayerLayoutValue("light", "highway_name_other", "text-size"),
      ).toBe(15);
      expect(await getLayerPaintValue("light", "water_name", "text-opacity")).toBe(0.7);
    });
  });

  it("darkens road labels in the light style for better readability", async () => {
    await withStubbedChrome(async () => {
      expect(
        await getLayerPaintValue("light", "highway_name_other", "text-color"),
      ).toBe("#6b7280");
      expect(
        await getLayerPaintValue("light", "highway_name_motorway", "text-color"),
      ).toBe("#5f6b7a");
    });
  });

  it("hides tunnel transportation layers", async () => {
    await withStubbedChrome(async () => {
      expect(
        await getLayerLayoutValue("light", "tunnel_motorway_casing", "visibility"),
      ).toBe("none");
      expect(
        await getLayerLayoutValue("light", "tunnel_motorway_inner", "visibility"),
      ).toBe("none");
    });
  });

  it("rotates one-way arrows to match the bundled sprite orientation", async () => {
    await withStubbedChrome(async () => {
      expect(await getLayerLayoutValue("dark", "road_oneway", "icon-rotate")).toBe(90);
      expect(
        await getLayerLayoutValue("dark", "road_oneway_opposite", "icon-rotate"),
      ).toBe(270);
    });
  });
});
