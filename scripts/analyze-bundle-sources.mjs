#!/usr/bin/env node

/* global Buffer, console, process */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DEFAULT_BUNDLES = [
  "build/chrome/content-bootstrap.js",
  "build/chrome/main-world-early.js",
  "build/chrome/main-world-runtime.js",
  "build/firefox/content-bootstrap.js",
  "build/firefox/main-world-early.js",
  "build/firefox/main-world-runtime.js",
];

const parseArgs = (argv) => {
  const result = {
    bundles: [],
    limit: 15,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") {
      const next = argv[index + 1];
      if (!next || !/^\d+$/.test(next)) {
        throw new Error("--limit requires a positive integer");
      }
      result.limit = Number(next);
      index += 1;
      continue;
    }

    if (arg === "--chrome") {
      result.bundles.push(
        ...DEFAULT_BUNDLES.filter((bundle) => bundle.includes("/chrome/")),
      );
      continue;
    }

    if (arg === "--firefox") {
      result.bundles.push(
        ...DEFAULT_BUNDLES.filter((bundle) => bundle.includes("/firefox/")),
      );
      continue;
    }

    result.bundles.push(arg);
  }

  if (result.bundles.length === 0) {
    result.bundles = DEFAULT_BUNDLES;
  }

  return result;
};

const formatBytes = (bytes) => `${bytes.toLocaleString("en-US")} B`;

const analyzeBundle = async (bundlePath, limit) => {
  const absoluteBundlePath = path.resolve(bundlePath);
  const mapPath = `${absoluteBundlePath}.map`;
  const bundle = await readFile(absoluteBundlePath);
  const sourceMap = JSON.parse(await readFile(mapPath, "utf8"));
  const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
  const sourcesContent = Array.isArray(sourceMap.sourcesContent)
    ? sourceMap.sourcesContent
    : [];

  const rows = sources
    .map((source, index) => ({
      source,
      bytes:
        typeof sourcesContent[index] === "string"
          ? Buffer.byteLength(sourcesContent[index], "utf8")
          : 0,
    }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);

  console.log(`\n${bundlePath}`);
  console.log(
    `  bundle: ${formatBytes(bundle.byteLength)} raw, ${formatBytes(gzipSync(bundle).byteLength)} gzip`,
  );
  console.log(
    `  sources: ${sources.length.toLocaleString("en-US")} total, top ${rows.length.toLocaleString("en-US")} by sourcemap sourceContent bytes`,
  );

  for (const row of rows) {
    console.log(`  ${formatBytes(row.bytes).padStart(12)}  ${row.source}`);
  }
};

const main = async () => {
  const { bundles, limit } = parseArgs(process.argv.slice(2));
  for (const bundle of bundles) {
    await analyzeBundle(bundle, limit);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
