const DEFAULT_MAX = 24;

export const symbolNameFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

export const symbolNameIgnores = [
  "**/*.d.{ts,mts,cts}",
  "**/*.generated.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "**/generated/**",
  "packages/refract-worker/src/generated-worker-source.ts",
];

const isImportBinding = (variable) =>
  variable.defs.length > 0 &&
  variable.defs.every((definition) => definition.type === "ImportBinding");

const getNodeKey = (node) => {
  if (node.range) {
    return `${node.range[0]}:${node.range[1]}`;
  }

  return `${node.loc.start.line}:${node.loc.start.column}:${node.name}`;
};

export const maxSymbolNameLengthRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Limit code-owned symbol names without constraining structural contract keys.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong: "Symbol '{{name}}' has {{length}} characters; the maximum is {{max}}.",
    },
  },

  create(context) {
    const max = context.options[0]?.max ?? DEFAULT_MAX;

    return {
      "Program:exit"() {
        const reportedNodes = new Set();

        for (const scope of context.sourceCode.scopeManager.scopes) {
          for (const variable of scope.variables) {
            if (
              variable.defs.length === 0 ||
              variable.name.length <= max ||
              isImportBinding(variable)
            ) {
              continue;
            }

            for (const identifier of variable.identifiers) {
              const nodeKey = getNodeKey(identifier);
              if (reportedNodes.has(nodeKey)) {
                continue;
              }
              reportedNodes.add(nodeKey);

              context.report({
                node: identifier,
                messageId: "tooLong",
                data: {
                  length: variable.name.length,
                  max,
                  name: variable.name,
                },
              });
            }
          }
        }
      },
    };
  },
};
