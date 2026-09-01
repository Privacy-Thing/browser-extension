import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import console from "node:console";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

const ITEM_ID_PATTERN = /^[a-p]{32}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_EXPANSION_RATIO = 100;

const readArgs = (argv) => {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(`Expected --name value arguments, received ${argv.join(" ")}`);
    }
    values.set(key.slice(2), value);
  }
  return values;
};

const extractCrxZip = (crx) => {
  if (crx.subarray(0, 2).toString("ascii") === "PK") return crx;
  if (crx.subarray(0, 4).toString("ascii") !== "Cr24") {
    throw new Error("CWS response is neither a CRX nor a ZIP archive.");
  }
  const crxVersion = crx.readUInt32LE(4);
  if (crxVersion !== 3) {
    throw new Error(`Unsupported CRX version: ${crxVersion}`);
  }
  const headerSize = crx.readUInt32LE(8);
  const zipOffset = 12 + headerSize;
  const zip = crx.subarray(zipOffset);
  if (zip.subarray(0, 2).toString("ascii") !== "PK") {
    throw new Error("CRX payload does not contain a ZIP archive.");
  }
  return zip;
};

const run = (command, commandArgs, failureMessage) => {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || failureMessage);
  }
  return result.stdout;
};

const validateArchiveEntries = (archivePath, compressedSize) => {
  const entries = run("unzip", ["-Z1", archivePath], "Could not list the CWS archive.")
    .split("\n")
    .filter(Boolean);
  for (const entry of entries) {
    const segments = entry.split("/");
    if (
      entry.includes("\\") ||
      path.posix.isAbsolute(entry) ||
      segments.includes("..")
    ) {
      throw new Error(`Unsafe path in CWS archive: ${entry}`);
    }
  }

  const entryModes = run(
    "unzip",
    ["-Z", "-l", archivePath],
    "Could not inspect the CWS archive.",
  );
  let uncompressedSize = 0;
  for (const line of entryModes.split("\n")) {
    const entry = /^([bcdlps-])[rwxStTs-]{9}\s+\S+\s+\S+\s+(\d+)\s/u.exec(line);
    if (!entry) continue;
    if (entry[1] !== "-" && entry[1] !== "d") {
      throw new Error("CWS archive contains a link or special file.");
    }
    uncompressedSize += Number(entry[2]);
    if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
      throw new Error("CWS archive exceeds the uncompressed size limit.");
    }
  }
  if (uncompressedSize > compressedSize * MAX_EXPANSION_RATIO) {
    throw new Error("CWS archive exceeds the safe expansion ratio.");
  }
};

const args = readArgs(process.argv.slice(2));
const itemId = args.get("item-id") ?? "";
const expectedVersion = args.get("expected-version") ?? "";
const outputDir = path.resolve(args.get("output-dir") ?? "");
const allowedRoot = path.resolve("build", "cws-smoke");

if (!ITEM_ID_PATTERN.test(itemId)) {
  throw new Error("--item-id must be a 32-character Chrome Web Store item ID.");
}
if (!VERSION_PATTERN.test(expectedVersion)) {
  throw new Error("--expected-version must be X.Y.Z or X.Y.Z.REV.");
}
if (outputDir === allowedRoot || !outputDir.startsWith(`${allowedRoot}${path.sep}`)) {
  throw new Error(`--output-dir must be a child of ${allowedRoot}`);
}

const updateUrl = new URL("https://clients2.google.com/service/update2/crx");
updateUrl.searchParams.set("response", "redirect");
updateUrl.searchParams.set("prodversion", "999.0.0.0");
updateUrl.searchParams.set("acceptformat", "crx3");
updateUrl.searchParams.set("x", `id=${itemId}&uc`);

const archivePath = path.join(allowedRoot, `${itemId}.zip`);
const downloadPath = path.join(allowedRoot, `${itemId}.crx`);

await rm(outputDir, { recursive: true, force: true });
await mkdir(allowedRoot, { recursive: true });
await rm(downloadPath, { force: true });
await rm(archivePath, { force: true });
run(
  "curl",
  [
    "--fail",
    "--location",
    "--silent",
    "--show-error",
    "--proto",
    "=https",
    "--proto-redir",
    "=https",
    "--max-filesize",
    String(MAX_DOWNLOAD_BYTES),
    "--max-time",
    "120",
    "--speed-limit",
    "1024",
    "--speed-time",
    "30",
    "--output",
    downloadPath,
    updateUrl.href,
  ],
  "Could not download the CWS artifact.",
);
const crx = await readFile(downloadPath);
if (crx.byteLength > MAX_DOWNLOAD_BYTES) {
  throw new Error("CWS artifact exceeds the download size limit.");
}
const zip = extractCrxZip(Buffer.from(crx));
await rm(downloadPath, { force: true });
await writeFile(archivePath, zip);
validateArchiveEntries(archivePath, zip.byteLength);
run("unzip", ["-tq", archivePath], "CWS archive integrity check failed.");

await mkdir(outputDir, { recursive: true });
run(
  "unzip",
  ["-q", "-o", archivePath, "-d", outputDir],
  "Could not extract the CWS artifact.",
);
await rm(archivePath, { force: true });

const manifest = JSON.parse(
  await readFile(path.join(outputDir, "manifest.json"), "utf8"),
);
if (manifest.version !== expectedVersion) {
  throw new Error(
    `CWS serves ${manifest.version ?? "an unknown version"}; expected ${expectedVersion}.`,
  );
}

console.log(`Prepared CWS ${itemId} v${manifest.version} in ${outputDir}`);
