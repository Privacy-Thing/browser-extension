import { readdir } from "node:fs/promises";
import path from "node:path";

import { E2E_OWNERSHIP_LANES } from "../config/e2e-lanes";

const e2eDirectory = path.resolve(process.cwd(), "tests/e2e");
const actualSpecs = (await readdir(e2eDirectory))
  .filter((file) => file.endsWith(".spec.ts"))
  .sort();

const owners = new Map<string, string[]>();
for (const [lane, files] of Object.entries(E2E_OWNERSHIP_LANES)) {
  for (const file of files) {
    owners.set(file, [...(owners.get(file) ?? []), lane]);
  }
}

const missing = actualSpecs.filter((file) => !owners.has(file));
const stale = [...owners.keys()].filter((file) => !actualSpecs.includes(file));
const duplicated = [...owners.entries()].filter(([, lanes]) => lanes.length !== 1);

if (missing.length || stale.length || duplicated.length) {
  const details = [
    missing.length ? `Unassigned specs: ${missing.join(", ")}` : "",
    stale.length ? `Lane entries without a spec: ${stale.join(", ")}` : "",
    duplicated.length
      ? `Specs assigned more than once: ${duplicated.map(([file, lanes]) => `${file} (${lanes.join(", ")})`).join(", ")}`
      : "",
  ].filter(Boolean);
  throw new Error(details.join("\n"));
}

console.log(
  `Validated ${actualSpecs.length} E2E specs across ${Object.keys(E2E_OWNERSHIP_LANES).length} ownership lanes.`,
);
