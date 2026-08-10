import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import {
  maxSymbolNameLengthRule,
  symbolNameFiles,
  symbolNameIgnores,
} from "../../config/eslint-rules/max-symbol-name-length.mjs";

const ruleId = "local/max-symbol-name-length";

const lintNames = (source: string, filename = "fixture.ts") => {
  const isTypeScript = /\.[cm]?tsx?$/.test(filename);
  const linter = new Linter();
  return linter
    .verify(
      source,
      [
        {
          files: symbolNameFiles,
          ignores: symbolNameIgnores,
          languageOptions: {
            ...(isTypeScript ? { parser: tsParser } : {}),
            ecmaVersion: "latest",
            sourceType: "module",
          },
          plugins: {
            local: {
              rules: {
                "max-symbol-name-length": maxSymbolNameLengthRule,
              },
            },
          },
          rules: {
            [ruleId]: ["error", { max: 24 }],
          },
        },
      ],
      { filename },
    )
    .filter((message) => message.ruleId === ruleId);
};

describe("local/max-symbol-name-length", () => {
  it("accepts 24 characters and rejects 25", () => {
    expect(lintNames("const abcdefghijklmnopqrstuvwx = 1;")).toHaveLength(0);
    expect(lintNames("const abcdefghijklmnopqrstuvwxy = 1;")).toHaveLength(1);
  });

  it("checks JavaScript bindings", () => {
    const messages = lintNames(
      `
        const variableDeclarationTooLong = 1;
        function functionDeclarationTooLong(parameterDeclarationTooLong) {
          try { return parameterDeclarationTooLong; }
          catch (caughtExceptionBindingTooLong) { return 0; }
        }
        class ClassDeclarationNameTooLong {}
        const { sourceField: destructuredBindingNameTooLong } = {};
        const fn = function NamedFunctionExpressionTooLong() {};
        const cls = class NamedClassExpressionTooLong {};
      `,
      "fixture.js",
    );

    expect(messages).toHaveLength(8);
  });

  it("checks TypeScript type declarations", () => {
    const messages = lintNames(`
      interface InterfaceDeclarationTooLong {}
      type TypeAliasDeclarationTooLong<TypeParameterDeclarationTooLong> = TypeParameterDeclarationTooLong;
      enum EnumDeclarationNameTooLong { EnumMemberDeclarationTooLong }
    `);

    expect(messages).toHaveLength(5);
  });

  it("ignores imports and structural keys", () => {
    const messages = lintNames(`
      import importBindingNameThatMayStayLong from "example";
      interface Contract {
        serializedPropertyNameThatMayStayLong: string;
        methodSignatureNameThatMayStayLong(): void;
      }
      class ContractHolder {
        classPropertyNameThatMayStayLong = 1;
        classMethodNameThatMayStayLong() {}
      }
      const value = { serializedPropertyNameThatMayStayLong: true };
      const { serializedPropertyNameThatMayStayLong: localValue } = value;
      value.serializedPropertyNameThatMayStayLong;
      void importBindingNameThatMayStayLong;
      void localValue;
    `);

    expect(messages).toHaveLength(0);
  });

  it("reports a class declaration only once across nested scopes", () => {
    const messages = lintNames("class ClassDeclarationNameTooLong {}");

    expect(messages).toHaveLength(1);
  });

  it.each([
    "fixture.d.ts",
    "fixture.generated.ts",
    "generated/fixture.ts",
    "packages/refract-worker/src/generated-worker-source.ts",
  ])("ignores excluded file %s", (filename) => {
    expect(
      lintNames("const symbolNameThatWouldNormallyFail = true;", filename),
    ).toHaveLength(0);
  });
});
