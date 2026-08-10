import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { en } from "./en";

type LocaleLeafKind = "string" | "function";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, "..");
const i18nRoot = __dirname;
const localeSectionsRoot = path.join(i18nRoot, "en-sections");

const collectLocaleLeafPaths = (
  value: unknown,
  prefix = "",
): Map<string, LocaleLeafKind> => {
  const result = new Map<string, LocaleLeafKind>();

  if (typeof value === "string" || typeof value === "function") {
    if (prefix) {
      result.set(prefix, typeof value === "function" ? "function" : "string");
    }
    return result;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    for (const [childPath, childKind] of collectLocaleLeafPaths(child, nextPrefix)) {
      result.set(childPath, childKind);
    }
  }

  return result;
};

const collectSourceFiles = (rootDir: string): string[] => {
  const files: string[] = [];

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "i18n") {
        continue;
      }
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }
    if (/(?:\.(?:target|chromium|firefox))?\.test\.tsx?$/.test(entry.name)) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
};

const extractExpressionPath = (
  expression: ts.Expression,
  aliases: ReadonlyMap<string, string> = new Map(),
): string | null => {
  if (ts.isIdentifier(expression)) {
    if (expression.text === "t") {
      return "";
    }
    return aliases.get(expression.text) ?? null;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const parentPath = extractExpressionPath(expression.expression, aliases);
    if (parentPath === null) {
      return null;
    }
    return parentPath ? `${parentPath}.${expression.name.text}` : expression.name.text;
  }

  if (ts.isParenthesizedExpression(expression)) {
    return extractExpressionPath(expression.expression, aliases);
  }

  if (ts.isElementAccessExpression(expression)) {
    const parentPath = extractExpressionPath(expression.expression, aliases);
    if (parentPath === null) {
      return null;
    }
    if (ts.isStringLiteral(expression.argumentExpression)) {
      const key = expression.argumentExpression.text;
      return parentPath ? `${parentPath}.${key}` : key;
    }
    // Dynamic argument (identifier) — cannot resolve statically here
    return null;
  }

  return null;
};

const collectAliases = (sourceFile: ts.SourceFile): Map<string, string> => {
  const aliases = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      const path = extractExpressionPath(declaration.initializer, aliases);
      if (path) {
        aliases.set(declaration.name.text, path);
      }
    }
  }

  return aliases;
};

/**
 * Walk up the AST from a dynamic identifier used as an element access argument
 * (e.g. `surface` in `t.foo[surface]`) and try to resolve its possible string
 * values from the enclosing `(["a","b"] as const).map((surface) => …)` pattern.
 */
const resolveAsConstValues = (argIdentifier: ts.Identifier): string[] | null => {
  let current: ts.Node = argIdentifier;
  while (current.parent) {
    current = current.parent;

    if (!ts.isArrowFunction(current) || current.parameters.length === 0) {
      continue;
    }

    const param = current.parameters[0];
    if (
      !param ||
      !ts.isIdentifier(param.name) ||
      param.name.text !== argIdentifier.text
    ) {
      continue;
    }

    // Found the arrow function whose parameter matches — check if parent is .map() call
    const callExpr = current.parent;
    if (
      !ts.isCallExpression(callExpr) ||
      !ts.isPropertyAccessExpression(callExpr.expression) ||
      callExpr.expression.name.text !== "map"
    ) {
      continue;
    }

    // The array is the object expression of the .map() property access
    let arrayNode: ts.Expression = callExpr.expression.expression;
    if (ts.isParenthesizedExpression(arrayNode)) {
      arrayNode = arrayNode.expression;
    }
    if (
      ts.isAsExpression(arrayNode) &&
      ts.isArrayLiteralExpression(arrayNode.expression)
    ) {
      arrayNode = arrayNode.expression;
    }
    if (ts.isArrayLiteralExpression(arrayNode)) {
      const values = arrayNode.elements
        .filter((el): el is ts.StringLiteral => ts.isStringLiteral(el))
        .map((el) => el.text);
      return values.length > 0 ? values : null;
    }
  }

  return null;
};

const collectUsedPaths = (filePath: string): Set<string> => {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const usedPaths = new Set<string>();

  if (!sourceText.includes("@/ui/i18n")) {
    return usedPaths;
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const importsTranslation = sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.getText(sourceFile) === '"@/ui/i18n"' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === "t",
      ),
  );

  if (!importsTranslation) {
    return usedPaths;
  }

  const translationAliases = collectAliases(sourceFile);

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node
      ) {
        return ts.forEachChild(node, visit);
      }
      if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
        return ts.forEachChild(node, visit);
      }
      if (
        ts.isElementAccessExpression(node.parent) &&
        node.parent.expression === node
      ) {
        return ts.forEachChild(node, visit);
      }

      const maybePath = extractExpressionPath(node, translationAliases);
      if (maybePath && maybePath.includes(".")) {
        usedPaths.add(maybePath);
      }
    }

    if (ts.isCallExpression(node)) {
      const maybePath = extractExpressionPath(node.expression, translationAliases);
      if (maybePath && maybePath.includes(".")) {
        usedPaths.add(maybePath);
      }
    }

    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.argumentExpression)
    ) {
      const prefixPath = extractExpressionPath(node.expression, translationAliases);
      if (prefixPath && prefixPath.includes(".")) {
        const values = resolveAsConstValues(node.argumentExpression);
        if (values) {
          // Walk up trailing PropertyAccessExpression chain to collect a suffix
          // e.g. `t.ns[surface].label.foo` → suffix = "label.foo"
          const suffixParts: string[] = [];
          let ancestor: ts.Node = node;
          while (
            ts.isPropertyAccessExpression(ancestor.parent) &&
            ancestor.parent.expression === ancestor
          ) {
            const parentAccess = ancestor.parent;
            suffixParts.push(parentAccess.name.text);
            ancestor = parentAccess;
          }
          const suffix = suffixParts.join(".");

          for (const value of values) {
            const fullPath = suffix
              ? `${prefixPath}.${value}.${suffix}`
              : `${prefixPath}.${value}`;
            usedPaths.add(fullPath);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return usedPaths;
};

let cachedUiTranslationPaths: ReadonlySet<string> | undefined;

const collectUiPaths = (): ReadonlySet<string> => {
  cachedUiTranslationPaths ??= new Set(
    collectSourceFiles(uiRoot).flatMap((filePath) => [...collectUsedPaths(filePath)]),
  );

  return cachedUiTranslationPaths;
};

const collectLocaleModules = async (): Promise<
  Array<{ code: string; value: unknown }>
> => {
  const localeFiles = fs
    .readdirSync(i18nRoot)
    .filter((name) => name.endsWith(".ts"))
    .filter((name) => !["index.ts", "types.ts"].includes(name))
    .filter((name) => !/(?:\.(?:target|chromium|firefox))?\.test\.ts$/.test(name));

  const modules: Array<{ code: string; value: unknown }> = [];

  for (const fileName of localeFiles) {
    const localeCode = fileName.replace(/\.ts$/, "");
    const moduleUrl = pathToFileURL(path.join(i18nRoot, fileName)).href;
    const localeModule = (await import(moduleUrl)) as Record<string, unknown>;
    modules.push({ code: localeCode, value: localeModule[localeCode] });
  }

  return modules;
};

describe("UI i18n coverage", () => {
  it("keeps the product name behind the shared branding token", () => {
    const hardCodedProductNames = collectSourceFiles(localeSectionsRoot).flatMap(
      (filePath) => {
        const sourceFile = ts.createSourceFile(
          filePath,
          fs.readFileSync(filePath, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        const matches: string[] = [];
        const visit = (node: ts.Node): void => {
          if (
            (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
            node.text.includes("Privacy Thing")
          ) {
            matches.push(
              `${path.relative(i18nRoot, filePath)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
            );
          }
          ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return matches;
      },
    );

    expect(hardCodedProductNames).toEqual([]);
  });

  it("does not reference missing translation keys from code", () => {
    const definedKeys = collectLocaleLeafPaths(en);
    const usedKeys = collectUiPaths();

    const missingKeys = [...usedKeys].filter((usedKey) => !definedKeys.has(usedKey));

    expect(missingKeys).toEqual([]);
  });

  it("does not keep unused translation leaf keys in the base locale", () => {
    const definedKeys = collectLocaleLeafPaths(en);
    const usedKeys = collectUiPaths();

    const unusedKeys = [...definedKeys.keys()].filter(
      (definedKey) => !usedKeys.has(definedKey),
    );

    expect(unusedKeys).toEqual([]);
  });

  it("keeps all locale packs aligned with the base locale shape", async () => {
    const baseKeys = collectLocaleLeafPaths(en);
    const localeModules = await collectLocaleModules();

    for (const localeModule of localeModules) {
      const localeKeys = collectLocaleLeafPaths(localeModule.value);
      const missingKeys = [...baseKeys.keys()].filter((key) => !localeKeys.has(key));
      const extraKeys = [...localeKeys.keys()].filter((key) => !baseKeys.has(key));
      const mismatchedKinds = [...baseKeys.entries()]
        .filter(([key]) => localeKeys.has(key))
        .filter(([key, kind]) => localeKeys.get(key) !== kind)
        .map(([key, kind]) => ({
          key,
          expected: kind,
          received: localeKeys.get(key),
        }));

      expect(
        {
          locale: localeModule.code,
          missingKeys,
          extraKeys,
          mismatchedKinds,
        },
        `Locale ${localeModule.code} diverged from en`,
      ).toEqual({
        locale: localeModule.code,
        missingKeys: [],
        extraKeys: [],
        mismatchedKinds: [],
      });
    }
  });
});
