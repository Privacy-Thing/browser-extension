import type { BrowserTarget } from "../types.js";

export function parseTargets(
  targets: string[],
  preset?: string,
  presets: Record<string, BrowserTarget[]> = {},
): BrowserTarget[] {
  let result: BrowserTarget[] = [];

  if (preset && presets[preset]) {
    result = [...presets[preset]];
  }

  for (const targetStr of targets) {
    const match = targetStr.match(/^(Chrome|Firefox|Safari|Edge)\s+(\d+(?:-\d+)?)$/i);
    if (match) {
      const name = match[1]!.toLowerCase() as BrowserTarget["name"];
      const versionStr = match[2]!;

      if (versionStr.includes("-")) {
        const [startStr, endStr] = versionStr.split("-");
        const start = Number(startStr);
        const end = Number(endStr);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) continue;
        // Generate all integer versions in the range — intermediate versions
        // matter for BCD checks since API support can change at any version.
        for (let v = start; v <= end; v++) {
          result.push({ name, version: v });
        }
      } else {
        result.push({ name, version: Number(versionStr) });
      }
    }
  }

  // Deduplicate targets that may appear via both preset and --target args.
  const seen = new Set<string>();
  return result.filter((t) => {
    const key = `${t.name}:${t.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
