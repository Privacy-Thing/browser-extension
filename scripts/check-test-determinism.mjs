/* global console */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = ["src", "packages", "scripts", "tests"]
  .map((directory) => path.join(root, directory))
  .filter(existsSync);
const testFilePattern = /(?:\.test\.[jt]sx?|\.spec\.[jt]sx?|\.stories\.[jt]sx?)$/;
const forbidden = [
  { label: "real setTimeout", pattern: /(^|[^.\w])setTimeout\s*\(/g },
  { label: "Playwright waitForTimeout", pattern: /\.waitForTimeout\s*\(/g },
  {
    label: "uncontrolled requestAnimationFrame",
    pattern: /(^|[^.\w])requestAnimationFrame\s*\(/g,
  },
];

const files = [];
const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(entryPath);
    else if (testFilePattern.test(entry.name)) files.push(entryPath);
  }
};
for (const directory of roots) visit(directory);

const violations = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const rule of forbidden) {
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${path.relative(root, file)}:${line}: ${rule.label}`);
    }
  }
}

if (violations.length) throw new Error(violations.join("\n"));
console.log(
  `Validated deterministic-wait policy in ${files.length} test and story files.`,
);
