import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const parseArgs = (argv) => {
  const args = {
    manifest: "",
    updateLink: "",
    output: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--manifest") {
      args.manifest = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--update-link") {
      args.updateLink = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--output") {
      args.output = argv[index + 1] ?? "";
      index += 1;
    }
  }

  if (!args.manifest) {
    throw new Error("Use --manifest <path>");
  }

  if (!args.updateLink) {
    throw new Error("Use --update-link <https-url>");
  }

  if (!/^https:\/\//.test(args.updateLink)) {
    throw new Error("Firefox update_link must use https");
  }

  if (!args.output) {
    throw new Error("Use --output <path>");
  }

  return args;
};

export const buildFxUpdateManifest = ({ addonId, version, updateLink }) => {
  if (!addonId) {
    throw new Error("Missing Firefox add-on ID");
  }

  if (!version) {
    throw new Error("Missing Firefox add-on version");
  }

  if (!updateLink || !/^https:\/\//.test(updateLink)) {
    throw new Error("Firefox update_link must use https");
  }

  return {
    addons: {
      [addonId]: {
        updates: [
          {
            version,
            update_link: updateLink,
          },
        ],
      },
    },
  };
};

export const readFxManifestMetadata = (manifestPath) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const addonId = String(manifest.browser_specific_settings?.gecko?.id ?? "").trim();
  const version = String(manifest.version ?? "").trim();

  if (!addonId) {
    throw new Error(`Missing browser_specific_settings.gecko.id in ${manifestPath}`);
  }

  if (!version) {
    throw new Error(`Missing version in ${manifestPath}`);
  }

  return {
    addonId,
    version,
  };
};

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const args = parseArgs(process.argv.slice(2));
  const metadata = readFxManifestMetadata(path.resolve(args.manifest));
  const updateManifest = buildFxUpdateManifest({
    addonId: metadata.addonId,
    version: metadata.version,
    updateLink: args.updateLink,
  });

  fs.writeFileSync(
    path.resolve(args.output),
    `${JSON.stringify(updateManifest, null, 2)}\n`,
  );
}
