export type BrandColorSlot = "letters" | "pin" | "face";

export type BrandColorOverrides = Partial<Record<BrandColorSlot, string>>;

export type BrandTone = "foreground" | "accent";

const COLOR_ID_PATTERN = /id="([^"]*kolor[^"]*)"/g;
const XML_PREFIX_PATTERN = /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!DOCTYPE[\s\S]*?>\s*)?/i;
const ROOT_SVG_PATTERN = /<svg\b([^>]*)>/i;
const WIDTH_ATTR_PATTERN = /\swidth="([^"]+)"/i;
const HEIGHT_ATTR_PATTERN = /\sheight="([^"]+)"/i;

const parseDimension = (value: string): number | null => {
  const normalized = Number.parseFloat(value.replace(/px$/i, "").trim());
  return Number.isFinite(normalized) ? normalized : null;
};

const normalizeRootSvg = (svgMarkup: string): string =>
  svgMarkup.replace(ROOT_SVG_PATTERN, (fullMatch, attrs: string) => {
    const widthMatch = attrs.match(WIDTH_ATTR_PATTERN);
    const heightMatch = attrs.match(HEIGHT_ATTR_PATTERN);
    const width = widthMatch?.[1] ? parseDimension(widthMatch[1]) : null;
    const height = heightMatch?.[1] ? parseDimension(heightMatch[1]) : null;
    const hasViewBox = /\sviewBox="/i.test(attrs);

    let normalizedAttrs = attrs
      .replace(WIDTH_ATTR_PATTERN, "")
      .replace(HEIGHT_ATTR_PATTERN, "");

    if (!hasViewBox && width !== null && height !== null) {
      normalizedAttrs += ` viewBox="0 0 ${width} ${height}"`;
    }

    return `<svg${normalizedAttrs}>`;
  });

export const slotFromColorId = (id: string): BrandColorSlot | null => {
  if (id === "litery_kolor" || id === "litery2_kolor") {
    return "letters";
  }

  if (id === "pin_kolor") {
    return "pin";
  }

  if (id === "twarz_kolor") {
    return "face";
  }

  return null;
};

export const collectColorTargets = (
  svgMarkup: string,
): Array<{ id: string; slot: BrandColorSlot }> => {
  const seen = new Set<string>();
  const targets: Array<{ id: string; slot: BrandColorSlot }> = [];

  for (const match of svgMarkup.matchAll(COLOR_ID_PATTERN)) {
    const id = match[1];
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const slot = slotFromColorId(id);
    if (slot) {
      targets.push({ id, slot });
    }
  }

  return targets;
};

export const injectColorSlotStyles = (
  svgMarkup: string,
  cssVarPrefix: string,
): string => {
  const normalizedMarkup = normalizeRootSvg(
    svgMarkup.replace(XML_PREFIX_PATTERN, "").trim(),
  );
  const targets = collectColorTargets(normalizedMarkup);
  if (targets.length === 0) {
    return normalizedMarkup;
  }

  const rules = targets.map(
    ({ id, slot }) =>
      `#${id},#${id} *{fill:var(--${cssVarPrefix}-${slot}) !important;}`,
  );
  const styleTag = `<style>${rules.join("")}</style>`;

  return normalizedMarkup.replace(/<svg\b([^>]*)>/, `<svg$1>${styleTag}`);
};
