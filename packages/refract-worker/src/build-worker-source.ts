import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_MATCH_LENGTH = 258;
const MAX_MATCH_OFFSET = 0x7fff;
const MAX_MATCH_CANDIDATES = 512;
const COMPACT_MATCH_OFFSET = 0x0fff;
const COMPACT_MATCH_LENGTH = 11;

const getMatchKey = (bytes: Uint8Array, offset: number): number | null =>
  offset + 2 < bytes.length
    ? (bytes[offset]! << 16) | (bytes[offset + 1]! << 8) | bytes[offset + 2]!
    : null;

const findBestMatch = (
  bytes: Uint8Array,
  position: number,
  candidates: number[] | undefined,
): { length: number; offset: number } => {
  let bestLength = 0;
  let bestOffset = 0;
  if (!candidates) {
    return { length: bestLength, offset: bestOffset };
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]!;
    const offset = position - candidate;
    if (offset > MAX_MATCH_OFFSET) {
      break;
    }

    const maximumLength = Math.min(MAX_MATCH_LENGTH, bytes.length - position);
    let length = 0;
    while (
      length < maximumLength &&
      bytes[candidate + length] === bytes[position + length]
    ) {
      length += 1;
    }

    if (length > bestLength) {
      bestLength = length;
      bestOffset = offset;
      if (bestLength === maximumLength) {
        break;
      }
    }
  }

  return { length: bestLength, offset: bestOffset };
};

type TokenInput = {
  output: number[];
  flags: number;
  bit: number;
  literal: number;
  match: { length: number; offset: number };
};

const writeToken = ({
  output,
  flags,
  bit,
  literal,
  match,
}: TokenInput): { consumed: number; flags: number } => {
  if (match.length < 4) {
    output.push(literal);
    return { consumed: 1, flags };
  }

  if (match.offset <= COMPACT_MATCH_OFFSET && match.length <= COMPACT_MATCH_LENGTH) {
    output.push(
      0x80 | ((match.offset >> 8) << 3) | (match.length - 4),
      match.offset & 0xff,
    );
  } else {
    output.push(match.offset >> 8, match.offset & 0xff, match.length - 3);
  }
  return { consumed: match.length, flags: flags | (1 << bit) };
};

/**
 * Encodes the minified worker runtime with a small deterministic LZSS stream.
 * The page runtime decodes it synchronously before a worker starts. Keeping the
 * compressed payload here avoids charging every document bundle for the full
 * worker source while preserving the generated-source drift check.
 */
const compressWorkerSource = (source: string): string => {
  const bytes = new TextEncoder().encode(source);
  const output: number[] = [];
  const positionsByKey = new Map<number, number[]>();

  const indexPosition = (position: number): void => {
    const key = getMatchKey(bytes, position);
    if (key === null) {
      return;
    }

    const positions = positionsByKey.get(key) ?? [];
    positions.push(position);
    if (positions.length > MAX_MATCH_CANDIDATES) {
      positions.shift();
    }
    positionsByKey.set(key, positions);
  };

  let position = 0;
  while (position < bytes.length) {
    const flagsOffset = output.length;
    output.push(0);
    let flags = 0;

    for (let bit = 0; bit < 8 && position < bytes.length; bit += 1) {
      const key = getMatchKey(bytes, position);
      const candidates = key === null ? undefined : positionsByKey.get(key);
      const match = findBestMatch(bytes, position, candidates);
      const token = writeToken({
        output,
        flags,
        bit,
        literal: bytes[position]!,
        match,
      });
      flags = token.flags;

      for (let index = 0; index < token.consumed; index += 1) {
        indexPosition(position + index);
      }
      position += token.consumed;
    }

    output[flagsOffset] = flags;
  }

  return Buffer.from(output).toString("base64");
};

/**
 * Bundles `worker-runtime.ts` (which imports the shared `@privacy-brand/refract-core`
 * logic) into a minified IIFE string embedded by `worker-bootstrap.ts`.
 *
 * Output is deterministic for a fixed esbuild version — reproducibility relies
 * on the lockfile pinning `esbuild` (CI installs with `--frozen-lockfile`).
 * Pass `--check` to verify the committed `generated-worker-source.ts` matches a
 * fresh bundle without writing; it exits non-zero on drift so a source change
 * that was not regenerated cannot silently ship stale worker logic.
 */
async function generateWorkerSource(): Promise<string> {
  const entryPoint = path.resolve(__dirname, "worker-runtime.ts");

  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    write: false,
    format: "iife",
    target: "es2022",
  });

  const runtimeParameters = new Map([
    ["__RF_WORKER_SNAPSHOT__", "__rfSnapshot"],
    ["__REFRACT_WORKER_URL__", "__rfWorkerUrl"],
    ["__RF_WORKER_LOG_TYPE__", "__rfLogType"],
    ["__RF_WORKER_GUARD__", "__rfGuard"],
    ["__RF_WORKER_ACK__", "__rfAck"],
  ]);
  let code = result.outputFiles[0]!.text;
  for (const [placeholder, parameter] of runtimeParameters) {
    if (!code.includes(placeholder)) {
      throw new Error(`Generated worker runtime is missing ${placeholder}.`);
    }
    code = code.replaceAll(placeholder, parameter);
  }
  const installerSource = `(${[...runtimeParameters.values()].join(",")})=>{${code}}`;
  const byteLength = new TextEncoder().encode(installerSource).length;
  const compressedCode = JSON.stringify(compressWorkerSource(installerSource));

  return `// This file is auto-generated by build-worker-source.ts. Do not edit directly.
export const COMPRESSED_WORKER_RUNTIME_SOURCE = ${compressedCode};
export const WORKER_RUNTIME_SOURCE_BYTE_LENGTH = ${byteLength};
`;
}

async function run() {
  const outputPath = path.resolve(__dirname, "generated-worker-source.ts");
  const checkOnly = process.argv.includes("--check");
  const generatedTsContent = await generateWorkerSource();

  if (checkOnly) {
    const existing = fs.existsSync(outputPath)
      ? fs.readFileSync(outputPath, "utf8")
      : "";

    if (existing !== generatedTsContent) {
      console.error(
        `[Refract Worker] ${path.basename(outputPath)} is out of date. ` +
          "Run `pnpm task generate:worker-source` and commit the result.",
      );
      process.exit(1);
    }

    console.log(`[Refract Worker] ${path.basename(outputPath)} is up to date.`);
    return;
  }

  fs.writeFileSync(outputPath, generatedTsContent, "utf8");
  console.log(`[Refract Worker] Wrote generated bundle to ${outputPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
