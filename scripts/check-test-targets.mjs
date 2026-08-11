/* global console */

import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { applyWildcards } from "./wildcard-pattern.mjs";

const root = process.cwd();
const write = process.argv.includes("--write");
const verbose = process.argv.includes("--verbose");
const sourceRoots = ["src", "packages", "scripts", "tools"]
  .map((directory) => path.join(root, directory))
  .filter(existsSync);
const sourceExtensions = [".ts", ".tsx", ".js", ".mjs", ".json"];
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|(?:vi|jest)\.mock\(\s*["']([^"']+)["']/g;
const buildTargetDeclarations = await readFile(
  path.join(root, "src/types/build-target.d.ts"),
  "utf8",
);
const buildTargetTokens = [
  ...buildTargetDeclarations.matchAll(/declare const ([A-Z0-9_]+):/g),
].map((match) => match[1]);
const targetTokenPattern = new RegExp(
  `\\b(?:${[...buildTargetTokens, "BUILD_BROWSER_TARGET"].join("|")})\\b`,
);
const targetAdapterPattern =
  /(?:^|\/)(?:bootstrap-target\.(?:chromium|firefox)|stubs\/bootstrap-resolver\.chromium|refract-browser\/src\/(?:chromium|firefox)\/)/;

const listFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(entryPath));
    else if (sourceExtensions.includes(path.extname(entry.name))) files.push(entryPath);
  }
  return files;
};

const allFiles = sourceRoots.flatMap(listFiles).map((file) => path.normalize(file));
const allFileSet = new Set(allFiles);
const packageRoots = new Map();
const tsconfig = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
const tsconfigPaths = Object.entries(tsconfig.compilerOptions?.paths ?? {}).sort(
  ([left], [right]) => right.length - left.length,
);
for (const packageDirectory of readdirSync(path.join(root, "packages"), {
  withFileTypes: true,
})) {
  if (!packageDirectory.isDirectory()) continue;
  const packageRoot = path.join(root, "packages", packageDirectory.name);
  const manifestPath = path.join(packageRoot, "package.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (typeof manifest.name === "string") {
    packageRoots.set(manifest.name, {
      root: packageRoot,
      exports: manifest.exports ?? {},
    });
  }
}

const resolveFile = (candidate) => {
  const normalized = path.normalize(candidate);
  if (allFileSet.has(normalized)) return normalized;
  if (/\.m?js$/.test(normalized)) {
    const withoutJavaScriptExt = normalized.replace(/\.m?js$/, "");
    for (const extension of [".ts", ".tsx"]) {
      if (allFileSet.has(`${withoutJavaScriptExt}${extension}`)) {
        return `${withoutJavaScriptExt}${extension}`;
      }
    }
  }
  for (const extension of sourceExtensions) {
    if (allFileSet.has(`${normalized}${extension}`)) return `${normalized}${extension}`;
  }
  for (const extension of sourceExtensions) {
    const indexPath = path.join(normalized, `index${extension}`);
    if (allFileSet.has(indexPath)) return indexPath;
  }
  return null;
};

const resolveTsconfigImport = (specifier) => {
  for (const [pattern, targets] of tsconfigPaths) {
    const [prefix, suffix = ""] = pattern.split("*");
    const isWildcard = pattern.includes("*");
    if (
      (!isWildcard && specifier !== pattern) ||
      (isWildcard && (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)))
    ) {
      continue;
    }
    const wildcard = isWildcard
      ? specifier.slice(prefix.length, specifier.length - suffix.length || undefined)
      : "";
    for (const target of targets) {
      const resolved = resolveFile(
        path.resolve(root, applyWildcards(target, wildcard)),
      );
      if (resolved) return resolved;
    }
    return null;
  }
  return undefined;
};

const resolveWorkspaceImport = (specifier) => {
  for (const [packageName, metadata] of packageRoots) {
    if (specifier !== packageName && !specifier.startsWith(`${packageName}/`)) continue;
    const exportKey =
      specifier === packageName ? "." : `./${specifier.slice(packageName.length + 1)}`;
    let exportTarget = metadata.exports[exportKey];
    if (!exportTarget && exportKey.includes("/")) {
      for (const [key, value] of Object.entries(metadata.exports)) {
        if (!key.includes("*")) continue;
        const [prefix, suffix = ""] = key.split("*");
        if (!exportKey.startsWith(prefix) || !exportKey.endsWith(suffix)) continue;
        const wildcard = exportKey.slice(
          prefix.length,
          exportKey.length - suffix.length || undefined,
        );
        exportTarget =
          typeof value === "string" ? applyWildcards(value, wildcard) : value;
        break;
      }
    }
    if (exportTarget && typeof exportTarget === "object")
      exportTarget = exportTarget.default ?? exportTarget.types;
    return typeof exportTarget === "string"
      ? resolveFile(path.resolve(metadata.root, exportTarget))
      : null;
  }
  return undefined;
};

const resolveImport = (importer, specifier) => {
  if (/\.(?:css|scss|svg|png|jpe?g|webp|woff2?)$/i.test(specifier)) return undefined;
  if (specifier.startsWith(".")) {
    const candidate = path.resolve(path.dirname(importer), specifier);
    if (path.extname(specifier) === ".json" && existsSync(candidate)) return undefined;
    return resolveFile(candidate);
  }
  const tsconfigResolved = resolveTsconfigImport(specifier);
  if (tsconfigResolved !== undefined) return tsconfigResolved;
  return resolveWorkspaceImport(specifier);
};

const contents = new Map();
const dependencies = new Map();
for (const file of allFiles) {
  const source = await readFile(file, "utf8");
  contents.set(file, source);
  const imports = [];
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    const resolved = resolveImport(file, specifier);
    if (resolved === undefined) continue;
    imports.push({ specifier, resolved });
  }
  dependencies.set(file, imports);
}

const classificationCache = new Map();
const classify = (file, stack = new Set()) => {
  const cached = classificationCache.get(file);
  if (cached) return cached;
  if (stack.has(file)) return { targetSensitive: false, reasons: [] };
  const nextStack = new Set(stack).add(file);
  const relativeFile = path.relative(root, file).replaceAll(path.sep, "/");
  const reasons = [];

  if (targetTokenPattern.test(contents.get(file) ?? ""))
    reasons.push(`${relativeFile}: build-target token`);
  if (targetAdapterPattern.test(relativeFile))
    reasons.push(`${relativeFile}: target adapter`);

  for (const dependency of dependencies.get(file) ?? []) {
    if (!dependency.resolved) {
      reasons.push(
        `${relativeFile}: unresolved local/workspace import ${dependency.specifier}`,
      );
      continue;
    }
    const dependencyClassification = classify(dependency.resolved, nextStack);
    if (dependencyClassification.targetSensitive)
      reasons.push(...dependencyClassification.reasons);
  }

  const result = {
    targetSensitive: reasons.length > 0,
    reasons: [...new Set(reasons)].slice(0, 5),
  };
  classificationCache.set(file, result);
  return result;
};

const isTest = (file) =>
  /\.(?:(?:chromium|firefox|target)\.)?test\.[jt]sx?$/.test(file);
const isBrowserSpecific = (file) => /\.(?:chromium|firefox)\.test\.[jt]sx?$/.test(file);
const isTargetNamed = (file) => /\.target\.test\.[jt]sx?$/.test(file);
const genericTests = allFiles.filter(isTest).filter((file) => !isBrowserSpecific(file));
const violations = [];
const renames = [];

for (const file of genericTests) {
  const classification = classify(file);
  if (verbose && classification.targetSensitive) {
    console.log(`${path.relative(root, file)}: ${classification.reasons.join("; ")}`);
  }
  if (classification.targetSensitive && !isTargetNamed(file)) {
    const destination = file.replace(/\.test(\.[jt]sx?)$/, ".target.test$1");
    if (write) renames.push([file, destination]);
    else
      violations.push(
        `${path.relative(root, file)} must use .target.test (${classification.reasons.join("; ")})`,
      );
  }
  if (!classification.targetSensitive && isTargetNamed(file)) {
    const destination = file.replace(/\.target\.test(\.[jt]sx?)$/, ".test$1");
    if (write) renames.push([file, destination]);
    else
      violations.push(
        `${path.relative(root, file)} no longer depends on target code and must use .test`,
      );
  }
}

for (const [source, destination] of renames) {
  if (existsSync(destination) || (existsSync(source) && !statSync(source).isFile())) {
    throw new Error(`Cannot rename ${source} to ${destination}`);
  }
  renameSync(source, destination);
  console.log(`${path.relative(root, source)} -> ${path.relative(root, destination)}`);
}

if (violations.length) throw new Error(violations.join("\n"));
console.log(
  `Validated ${genericTests.length} generic unit tests; ${renames.length} file(s) renamed.`,
);
