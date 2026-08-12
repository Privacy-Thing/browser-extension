import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import { importX as importPlugin } from "eslint-plugin-import-x";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import sonarjsPlugin from "eslint-plugin-sonarjs";

import {
  maxSymbolNameLengthRule,
  symbolNameFiles,
  symbolNameIgnores,
} from "./eslint-rules/max-symbol-name-length.mjs";

const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([name, configuration]) => [
      name,
      Array.isArray(configuration)
        ? ["warn", ...configuration.slice(1)]
        : configuration === "off" || configuration === 0
          ? "off"
          : "warn",
    ]),
  );

export default [
  // 1. Globalne ignorowanie
  {
    ignores: [
      ".claude/**",
      ".web-ext-profile/**",
      "build/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },

  eslint.configs.recommended,

  // 2. Globalna konfiguracja dla TS i importów
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "off",
      "no-unused-vars": "off",
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },

  // 3. Code-owned symbol length. Structural keys and imports are intentionally
  // excluded by the rule because they frequently represent durable contracts.
  {
    files: symbolNameFiles,
    ignores: symbolNameIgnores,
    plugins: {
      local: {
        rules: {
          "max-symbol-name-length": maxSymbolNameLengthRule,
        },
      },
    },
    rules: {
      "local/max-symbol-name-length": ["error", { max: 24 }],
    },
  },

  // 4. Połączona strefa React / UI (Zoptymalizowana)
  {
    files: ["src/ui/**/*.{ts,tsx}", "packages/ui/src/**/*.{ts,tsx}"],
    ignores: ["**/*.stories.tsx", "**/*.test.tsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
    },
    rules: {
      // Reguły z react-hooks
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-array-index-key": "warn",

      // Reguły dostępności przemielone na warningi
      ...asWarnings(
        jsxA11yPlugin.flatConfigs?.recommended?.rules ||
          jsxA11yPlugin.configs?.recommended?.rules ||
          {},
      ),
    },
  },

  // 5. Analiza statyczna kodu (SonarJS)
  {
    ...sonarjsPlugin.configs.recommended,
    files: ["src/**/*.{js,ts,tsx}", "packages/**/*.{js,ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/*.stories.tsx"],
    rules: {
      ...sonarjsPlugin.configs.recommended.rules,
      // With exactOptionalPropertyTypes, `field?: T` and
      // `field?: T | undefined` are not equivalent assignment contracts.
      "sonarjs/no-redundant-optional": "off",
    },
  },

  {
    files: ["packages/platform-api-conformance/src/runtime/snapshot-page.ts"],
    rules: {
      // Dynamic expression evaluation is the core of these page-context probes.
      "sonarjs/code-eval": "off",
    },
  },

  {
    files: ["packages/platform-api-conformance/src/**/*.ts"],
    rules: {
      // Probe/reporting tooling intentionally prioritizes exhaustive inspection
      // over low branching counts, and several nested template strings are
      // formatter-friendly serializers rather than product-facing logic.
      "sonarjs/anchor-precedence": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-nested-template-literals": "off",
    },
  },

  {
    files: [
      "src/injection/shared/geo-behavior.ts",
      "packages/refract-core/src/geolocation/firefox-geolocation-bridge.ts",
    ],
    rules: {
      // Geolocation spoofing deliberately uses randomized behavior as part of
      // the product surface; replacing it with deterministic output is worse.
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/pseudo-random": "off",
    },
  },

  {
    // Developer scripts may contain page-context callbacks passed to Playwright.
    // They therefore need both Node and browser globals during static linting.
    files: [
      "scripts/capture-website-screenshots.mjs",
      "scripts/run-performance-audit.mjs",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: "readonly",
      },
    },
  },

  {
    files: ["packages/ui/src/ui/**/*.{ts,tsx}"],
    rules: {
      // Shared UI primitives still contain some compact ternary-based render
      // branches; keep the package lintable while the product surfaces adopt
      // Sonar incrementally.
      "sonarjs/no-nested-conditional": "off",
    },
  },

  // 6. Wyjątki dla typów d.ts
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },

  // 7. Complexity limits for product and shared-package source.
  //
  // The rules stay warnings so editors present them as design guidance. The
  // repository lint task runs ESLint with `--max-warnings 0`, so every warning
  // still blocks local verification and CI without changing editor severity.
  //
  // Tests, stories and harness fixtures are excluded: `describe()` callbacks are
  // functions to ESLint, so a length budget there measures nothing useful.
  //
  // See docs/code-style.md.
  {
    files: ["src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.stories.tsx",
      "**/*.d.ts",
      "**/*.generated.ts",
      "packages/refract-test-harness/**",
      "packages/refract-worker/src/generated-worker-source.ts",
    ],
    rules: {
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: false },
      ],
      "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
];
