import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { afterAll, expect, test } from "vitest";

import {
  BRAND_DISPLAY_NAME,
  buildSourceArchiveName,
} from "../../scripts/brand-config.mjs";

const releaseVersion = (
  JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
    version: string;
  }
).version;
const archivePath = path.resolve(
  "build",
  "artifacts",
  buildSourceArchiveName(`v${releaseVersion}`),
);
const preexisting = existsSync(archivePath);

// Packaging is cheap (git archive plus two zip passes) and the release channel
// keeps the artifact name derived from package.json rather than the clock.
const packageSource = () => {
  const result = spawnSync("node", ["scripts/package-source-code.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PT_BUILD_CHANNEL: "release",
      PT_RELEASE_VERSION: releaseVersion,
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "package-source-code.mjs failed");
  }
};

const listArchive = () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import sys,zipfile;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))",
      archivePath,
    ],
    {
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || "could not read the source archive");
  }

  return result.stdout.trim().split("\n");
};

const listRetiredNameHits = (): Array<{ path: string; count: number }> => {
  const retiredName = ["geo", "warp"].join("");
  const result = spawnSync(
    "python3",
    [
      "-c",
      [
        "import json,sys,zipfile",
        "archive_path, retired_name = sys.argv[1:3]",
        "hits = []",
        "with zipfile.ZipFile(archive_path) as archive:",
        "    for name in archive.namelist():",
        "        if name.endswith('/'):",
        "            continue",
        "        source = archive.read(name).decode('utf-8', errors='ignore')",
        "        count = source.casefold().count(retired_name.casefold())",
        "        if count:",
        "            relative = name.split('/', 1)[1] if '/' in name else name",
        "            hits.append({'path': relative, 'count': count})",
        "print(json.dumps(hits))",
      ].join("\n"),
      archivePath,
      retiredName,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || "could not scan the source archive");
  }
  return (JSON.parse(result.stdout) as Array<{ path: string; count: number }>).sort(
    (left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
  );
};

afterAll(() => {
  if (!preexisting) {
    rmSync(archivePath, { force: true });
  }
});

// AMO reviewers and downstream recipients receive this archive. Keep the public
// grant, its full standard text, project terms and commercial option together.
test("ships the project legal files with the source archive", () => {
  packageSource();
  const entries = listArchive();
  const prefix = entries[0]?.split("/")[0] ?? "";
  const relativeEntries = entries.map((entry) => entry.slice(prefix.length + 1));

  expect(relativeEntries).toContain("LICENSE.md");
  expect(relativeEntries).toContain("NOTICE.md");
  expect(relativeEntries).toContain("licenses/privacything/THIRD_PARTY_NOTICES.md");
  expect(relativeEntries).toContain("licenses/privacything/BRANDING.md");
  expect(relativeEntries).toContain("licenses/privacything/COMMERCIAL_LICENSE.md");
  expect(relativeEntries).toContain("licenses/AGPL-3.0.txt");
  expect(relativeEntries.some((entry) => /^licenses\/[^/]+\.txt$/.test(entry))).toBe(
    true,
  );

  const manifest = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
    license: string;
  };

  expect(manifest.license).toBe("AGPL-3.0-or-later");
  expect(readFileSync(path.resolve("LICENSE.md"), "utf8")).toContain(
    `# ${BRAND_DISPLAY_NAME} License`,
  );
});

test("keeps the source archive on the strict retired-name allowlist", () => {
  packageSource();

  expect(listRetiredNameHits()).toEqual([
    { path: "config/brand-config.json", count: 2 },
    { path: "src/shared/extension-notifications.json", count: 2 },
  ]);
});
