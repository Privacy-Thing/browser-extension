import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ITEM_ID_PATTERN = /^[a-p]{32}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

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

const response = await fetch(updateUrl, { redirect: "follow" });
if (!response.ok) {
  throw new Error(`CWS download failed with HTTP ${response.status}.`);
}
const zip = extractCrxZip(Buffer.from(await response.arrayBuffer()));
const archivePath = path.join(allowedRoot, `${itemId}.zip`);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(allowedRoot, { recursive: true });
await writeFile(archivePath, zip);

const unzip = spawnSync("unzip", ["-q", "-o", archivePath, "-d", outputDir], {
  encoding: "utf8",
});
await rm(archivePath, { force: true });
if (unzip.status !== 0) {
  throw new Error(unzip.stderr || "Could not extract the CWS artifact.");
}

const manifest = JSON.parse(
  await readFile(path.join(outputDir, "manifest.json"), "utf8"),
);
if (manifest.version !== expectedVersion) {
  throw new Error(
    `CWS serves ${manifest.version ?? "an unknown version"}; expected ${expectedVersion}.`,
  );
}

console.log(`Prepared CWS ${itemId} v${manifest.version} in ${outputDir}`);
