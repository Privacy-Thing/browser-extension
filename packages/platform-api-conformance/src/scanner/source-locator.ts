/**
 * Best-effort source location correlator.
 *
 * Scans runtime source directories for property-definition patterns and builds an index
 * mapping property names → source locations. Used to annotate runtime findings
 * with the likely declaration site in source code.
 *
 * **Surface-aware**: each indexed location carries the API surface inferred from
 * the target expression (e.g., `NativeDate.prototype` → `"Date"`). When looking
 * up an API path like `Date.prototype.toJSON`, the locator prefers locations
 * whose surface matches `"Date"` and excludes those targeting a different surface
 * (e.g., `"NavigatorUAData"`). This prevents false positives where the same
 * property name is defined on unrelated objects.
 *
 * When no direct property match exists, falls back to **surface entry points** —
 * lines where an entire API surface is created or replaced (e.g.,
 * `Object.defineProperties(NativeDate.prototype, {...})`, `globalThis.Date = ...`).
 *
 * Heuristic-based — relies on regex matching, NOT AST analysis.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface SourceLocation {
  /** Relative file path from project root */
  file: string;
  /** 1-based line number */
  line: number;
  /**
   * API surface inferred from the target expression (e.g., "Date", "Navigator").
   * Undefined when the target is a variable or otherwise unresolvable.
   */
  surface?: string;
}

// ---------------------------------------------------------------------------
// Target → Surface resolution
// ---------------------------------------------------------------------------

/**
 * Known Intl constructor names. Used to recognize variable aliases like
 * `NativeDateTimeFormat`, `SpoofedDateTimeFormat`, `PatchedNumberFormat`, etc.
 * and map them back to `Intl.DateTimeFormat`, `Intl.NumberFormat`, etc.
 */
const INTL_CONSTRUCTOR_NAMES = new Set([
  "DateTimeFormat",
  "NumberFormat",
  "Collator",
  "RelativeTimeFormat",
  "ListFormat",
  "DisplayNames",
  "PluralRules",
  "Segmenter",
]);

/**
 * Resolves a target expression captured from a defineProperty/defineGetter/
 * defineProperties call to an API surface name.
 *
 * Examples:
 *   - `NativeDate.prototype`              → `"Date"`
 *   - `Navigator.prototype`               → `"Navigator"`
 *   - `Intl.DateTimeFormat.prototype`      → `"Intl.DateTimeFormat"`
 *   - `NativeDateTimeFormat.prototype`     → `"Intl.DateTimeFormat"`
 *   - `SpoofedDateTimeFormat.prototype`    → `"Intl.DateTimeFormat"`
 *   - `NativeIntlDateTimeFormat`           → `"Intl.DateTimeFormat"`
 *   - `target` (variable)                  → `undefined`
 */
function resolveTargetSurface(targetExpr: string): string | undefined {
  if (targetExpr === "localFunctionPrototype") return "Function";

  // Intl.X.prototype or NativeIntl.X.prototype (dot notation)
  const intlMatch = targetExpr.match(/^(?:Native)?Intl\.(\w+)(?:\.prototype)?$/);
  if (intlMatch?.[1]) return `Intl.${intlMatch[1]}`;

  // Known Intl constructor aliases: (Native|Spoofed|Patched)?(Intl)?DateTimeFormat(.prototype)?
  // Handles variable names like NativeDateTimeFormat, SpoofedDateTimeFormat,
  // PatchedNumberFormat, NativeIntlDateTimeFormat, etc.
  const bareExpr = targetExpr.replace(/\.prototype$/, "");
  const intlAlias = bareExpr.match(/^(?:Native|Spoofed|Patched)?(?:Intl)?(\w+)$/);
  if (intlAlias?.[1] && INTL_CONSTRUCTOR_NAMES.has(intlAlias[1])) {
    return `Intl.${intlAlias[1]}`;
  }

  // X.prototype or NativeX.prototype
  const protoMatch = targetExpr.match(/^(?:Native)?(\w+)\.prototype$/);
  if (protoMatch?.[1]) return protoMatch[1];

  // globalThis.X or window.X
  const globalMatch = targetExpr.match(/^(?:globalThis|window)\.(\w+)$/);
  if (globalMatch?.[1]) return globalMatch[1];

  // NativeX (standalone, e.g., `NativeDate`)
  const nativeMatch = targetExpr.match(/^Native(\w+)$/);
  if (nativeMatch?.[1]) return nativeMatch[1];

  return undefined;
}

/**
 * Extracts the API surface name from a fully-qualified API path.
 *
 * Examples:
 *   - `Date.prototype.getTime`           → `"Date"`
 *   - `Intl.DateTimeFormat.prototype.format` → `"Intl.DateTimeFormat"`
 *   - `Navigator.prototype.language`      → `"Navigator"`
 *   - `Date` (bare surface, no property)  → `undefined`
 */
export function extractSurface(apiPath: string): string | undefined {
  // "X.prototype.prop" → "X"
  const protoIdx = apiPath.indexOf(".prototype.");
  if (protoIdx !== -1) return apiPath.slice(0, protoIdx);

  // Static property: "Date.now" → "Date" (must have at least 2 segments)
  const dotIdx = apiPath.indexOf(".");
  if (dotIdx !== -1) {
    const prefix = apiPath.slice(0, dotIdx);
    // Guard: only return if there's actually a property after the dot
    if (prefix && dotIdx < apiPath.length - 1) return prefix;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * Direct `defineProperty`/`defineGetter` calls with a quoted property name,
 * including the captured-primordial wrapper used by the shared runtime core.
 * Group 1 = target expression, Group 2 = property name.
 */
const DIRECT_DEFINE_RE =
  /(?:privateDefineProperty|(?:Object\.)?(?:defineProperty|defineGetter))\s*\(\s*([\w.[\]]+)\s*,\s*"(\w+)"/;

/**
 * Start of a descriptor-map block:
 *   - `Object.defineProperties(target, {`  → Group 1 = target expression
 *   - `const x: PropertyDescriptorMap = {` → Group 1 = undefined
 * We track brace depth from the opening `{` to know when the block ends.
 */
const DESCRIPTOR_START_RE =
  /(?:Object\.defineProperties\s*\(([\w.[\]]+)\s*,\s*\{|:\s*PropertyDescriptorMap\s*=\s*\{)/;

/**
 * Inside a descriptor block, match a property key that starts a descriptor
 * definition. Captures keys like `getTimezoneOffset: {` or `getCurrentPosition: {`.
 */
const OBJECT_KEY_RE = /^\s+(\w+)\s*:\s*\{/;

/** Descriptor-attribute keywords that are NOT API property names. */
const DESCRIPTOR_ATTR_KEYWORDS = new Set([
  "value",
  "get",
  "set",
  "writable",
  "enumerable",
  "configurable",
]);

/**
 * How many following lines may be folded into one logical line. Three covers the
 * `call(\n  Target.prototype,\n  property,` shape Prettier produces for the
 * injection runtime's `defineGetter`/`defineProperty` calls.
 */
const LOGICAL_LINE_LOOKAHEAD = 3;

/** A line that ends mid-call, so the next line is still the same expression. */
const OPEN_CALL_TAIL_RE = /[([,]\s*$/;

/**
 * Folds a wrapped call back into a single string so the line-oriented patterns
 * above can see the call head and its first argument together.
 *
 * The formatter is free to split `defineGetter(Navigator.prototype, prop, ...)`
 * across lines; without folding, `DIRECT_DEFINE_RE` and the surface-entry
 * patterns silently stop matching and the surface disappears from the index.
 * Only lines that clearly continue a call are joined, so unrelated adjacent
 * statements are never glued together.
 */
const buildLogicalLine = (lines: readonly string[], index: number): string => {
  let logical = lines[index]!;
  if (!OPEN_CALL_TAIL_RE.test(logical)) {
    return logical;
  }

  for (let offset = 1; offset <= LOGICAL_LINE_LOOKAHEAD; offset++) {
    const next = lines[index + offset];
    if (next === undefined) {
      break;
    }
    logical = `${logical.trimEnd()} ${next.trim()}`;
    if (!OPEN_CALL_TAIL_RE.test(logical)) {
      break;
    }
  }

  return logical;
};

/**
 * Surface entry point patterns — lines that create/replace an entire API surface.
 * Used as fallback when no direct property match exists.
 */
const SURFACE_ENTRY_PATTERNS: {
  regex: RegExp;
  /** Extracts the surface name from the match. */
  surface: (match: RegExpMatchArray) => string | undefined;
}[] = [
  // defineNativeGetter(Navigator.prototype, property, ...) or
  // defineGetter(MediaDevices.prototype, property, ...)
  // Dynamic property-name helpers still establish that the surface is patched,
  // even when the property regex cannot resolve the quoted key.
  {
    regex: /\bdefine\w+\s*\(\s*([\w.]+\.prototype)\s*,/,
    surface: (m) => (m[1] ? resolveTargetSurface(m[1]) : undefined),
  },
  // Object.defineProperties(target, ...) — any call, not just block-start
  {
    regex: /Object\.defineProperties\s*\(\s*([\w.[\]]+)\s*,/,
    surface: (m) => (m[1] ? resolveTargetSurface(m[1]) : undefined),
  },
  // globalThis.Date = SpoofedDate (but NOT globalThis.postMessage === ...)
  {
    regex: /globalThis\.(\w+)\s*=(?!=)/,
    surface: (m) => m[1],
  },
  // class SpoofedDate extends NativeDate
  // class SpoofedDateTimeFormat extends NativeIntlDateTimeFormat
  {
    regex: /class\s+\w+\s+extends\s+([\w.]+)/,
    surface: (m) => resolveTargetSurface(m[1] ?? ""),
  },
  // Intl.DateTimeFormat = SpoofedDateTimeFormat (but NOT Intl.DateTimeFormatOptions => or comparisons == / ===)
  {
    regex: /Intl\.(\w+)\s*=(?![=>])/,
    surface: (m) => (m[1] ? `Intl.${m[1]}` : undefined),
  },
  // Object.defineProperty/privateDefineProperty(globalThis, "Worker", { ... })
  {
    regex:
      /(?:privateDefineProperty|Object\.defineProperty)\s*\(\s*globalThis\s*,\s*"(\w+)"/,
    surface: (m) => m[1],
  },
];

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

function walkSourceFiles(dir: string, callback: (path: string) => void): void {
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walkSourceFiles(fullPath, callback);
      } else if (
        entry.endsWith(".ts") &&
        !entry.endsWith(".test.ts") &&
        !entry.endsWith(".d.ts")
      ) {
        callback(fullPath);
      }
    }
  } catch {
    // Ignore unreadable directories
  }
}

// ---------------------------------------------------------------------------
// SourceLocator
// ---------------------------------------------------------------------------

export class SourceLocator {
  /** property name → locations where it's defined */
  private propertyIndex = new Map<string, SourceLocation[]>();

  /** surface name → entry point locations (whole-surface patches) */
  private surfaceEntryPoints = new Map<string, SourceLocation[]>();

  /**
   * Scans injection source files and builds a surface-aware index mapping
   * property names to their definition sites plus surface entry points for
   * fallback. Call once, then use `locate()` for each API path.
   *
   * @param injectionDirs Absolute path to `src/injection/` or multiple directories
   * @param projectRoot   Absolute path to project root (for relative path display)
   */
  buildIndex(injectionDirs: string | string[], projectRoot: string): void {
    this.propertyIndex.clear();
    this.surfaceEntryPoints.clear();

    const dirs = Array.isArray(injectionDirs) ? injectionDirs : [injectionDirs];

    for (const dir of dirs) {
      walkSourceFiles(dir, (filePath) => {
        const relPath = relative(projectRoot, filePath);
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        let inDescriptorBlock = false;
        let braceDepth = 0;
        let blockSurface: string | undefined;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const lineNum = i + 1;
          // Call-shaped patterns match against the folded line so a formatter
          // line break cannot hide a surface; positions still report line `i`.
          const logicalLine = buildLogicalLine(lines, i);

          // ---- Surface entry points ----
          for (const { regex, surface: extractFn } of SURFACE_ENTRY_PATTERNS) {
            const entryMatch = regex.exec(logicalLine);
            if (entryMatch) {
              const surface = extractFn(entryMatch);
              if (surface) {
                this.addEntryPoint(surface, relPath, lineNum);
              }
            }
          }

          // ---- Pattern 1: direct defineProperty / defineGetter ----
          const directMatch = DIRECT_DEFINE_RE.exec(logicalLine);
          if (directMatch?.[1] && directMatch[2]) {
            const target = directMatch[1];
            const propName = directMatch[2];
            const surface = resolveTargetSurface(target);
            this.addLocation(propName, relPath, lineNum, surface);
          }

          // ---- Pattern 2: descriptor-map blocks ----
          if (!inDescriptorBlock && DESCRIPTOR_START_RE.test(line)) {
            inDescriptorBlock = true;
            braceDepth = 0;

            // Determine block surface from target expression
            const blockMatch = DESCRIPTOR_START_RE.exec(line);
            blockSurface = blockMatch?.[1]
              ? resolveTargetSurface(blockMatch[1])
              : undefined;

            for (const ch of line) {
              if (ch === "{") braceDepth++;
              if (ch === "}") braceDepth--;
            }
            continue;
          }

          if (inDescriptorBlock) {
            for (const ch of line) {
              if (ch === "{") braceDepth++;
              if (ch === "}") braceDepth--;
            }

            const keyMatch = OBJECT_KEY_RE.exec(line);
            if (keyMatch?.[1] && !DESCRIPTOR_ATTR_KEYWORDS.has(keyMatch[1])) {
              this.addLocation(keyMatch[1], relPath, lineNum, blockSurface);
            }

            if (braceDepth <= 0) {
              inDescriptorBlock = false;
              blockSurface = undefined;
            }
          }
        }
      });
    }
  }

  /**
   * Returns the set of all unique surface names discovered during indexing.
   * Includes surfaces from both direct property matches and entry points.
   *
   * Useful for validating that the config's `apiSurfaces` list stays in sync
   * with the actual injection source code.
   */
  getDiscoveredSurfaces(): Set<string> {
    const surfaces = new Set<string>();
    for (const locations of this.propertyIndex.values()) {
      for (const loc of locations) {
        if (loc.surface) surfaces.add(loc.surface);
      }
    }
    for (const surface of this.surfaceEntryPoints.keys()) {
      surfaces.add(surface);
    }
    return surfaces;
  }

  /**
   * Returns the number of unique indexed API property sites.
   *
   * Duplicated injection paths for the same public surface/property pair are
   * intentionally collapsed so cross-browser and worker mirrors do not inflate
   * completeness heuristics. When the surface cannot be resolved, the leaf
   * property name is used as a best-effort dedupe key so repeated alias-based
   * mirrors still collapse instead of dominating the count.
   */
  getIndexedPropertyCount(): number {
    const indexedProperties = new Set<string>();

    for (const [propertyName, locations] of this.propertyIndex) {
      for (const location of locations) {
        indexedProperties.add(
          location.surface ? `${location.surface}.${propertyName}` : propertyName,
        );
      }
    }

    return indexedProperties.size;
  }

  /**
   * Given a full API path (e.g., `"Date.prototype.getTimezoneOffset"`),
   * returns source locations where the leaf property is defined, filtered
   * by surface to avoid false positives.
   *
   * Priority order:
   *   1. Direct property matches whose surface matches the API path's surface
   *   2. Surface entry points (whole-surface patch sites) for the API surface
   *   3. Direct property matches with unknown (undefined) surface
   *   4. Empty array
   *
   * Matches for a *different* surface are always excluded.
   */
  locate(apiPath: string): readonly SourceLocation[] {
    const parts = apiPath.split(".");
    const propName = parts[parts.length - 1];
    if (!propName) return [];

    const surface = extractSurface(apiPath);
    const allMatches = this.propertyIndex.get(propName) ?? [];

    if (surface && allMatches.length > 0) {
      const surfaceMatches = allMatches.filter((l) => l.surface === surface);
      if (surfaceMatches.length > 0) return surfaceMatches;

      // No surface matches — try entry points before falling back to unknown
      const entryPoints = this.surfaceEntryPoints.get(surface);
      if (entryPoints && entryPoints.length > 0) return entryPoints;

      // Last resort: definitions with unknown surface (variable targets)
      const unknownSurface = allMatches.filter((l) => l.surface === undefined);
      if (unknownSurface.length > 0) return unknownSurface;

      // All matches are for wrong surfaces
      return [];
    }

    // No surface in API path or no direct matches
    if (allMatches.length > 0) return allMatches;

    // Fallback to entry points
    if (surface) {
      return this.surfaceEntryPoints.get(surface) ?? [];
    }

    return [];
  }

  /**
   * Formats source locations into a single-line string for `Finding.location`.
   * Returns `undefined` when there are no matches.
   *
   * Example: `"src/injection/main/locale-patch.ts:53, src/injection/main/index.ts:453"`
   */
  formatLocations(apiPath: string): string | undefined {
    const locations = this.locate(apiPath);
    if (locations.length === 0) return undefined;

    const seen = new Set<string>();
    const parts: string[] = [];
    for (const loc of locations) {
      const key = `${loc.file}:${loc.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        parts.push(key);
      }
    }

    return parts.join(", ");
  }

  private addLocation(
    propName: string,
    file: string,
    line: number,
    surface: string | undefined,
  ): void {
    const entry: SourceLocation = { file, line };
    if (surface !== undefined) entry.surface = surface;
    const existing = this.propertyIndex.get(propName);
    if (existing) {
      existing.push(entry);
    } else {
      this.propertyIndex.set(propName, [entry]);
    }
  }

  private addEntryPoint(surface: string, file: string, line: number): void {
    const entry: SourceLocation = { file, line, surface };
    const existing = this.surfaceEntryPoints.get(surface);
    if (existing) {
      // Deduplicate: same file:line can match multiple entry point patterns
      if (!existing.some((e) => e.file === file && e.line === line)) {
        existing.push(entry);
      }
    } else {
      this.surfaceEntryPoints.set(surface, [entry]);
    }
  }
}
