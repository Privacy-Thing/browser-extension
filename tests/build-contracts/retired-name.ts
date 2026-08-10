import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type BuildTarget = "chrome" | "firefox";

const retiredName = ["geo", "warp"].join("");
const retiredNamePattern = new RegExp(retiredName, "i");

const collectFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
    }),
  );
  return files.flat();
};

const readApprovedBuildStrings = async () => {
  const [brandSource, notificationsSource] = await Promise.all([
    readFile(path.resolve("config/brand-config.json"), "utf8"),
    readFile(path.resolve("src/shared/extension-notifications.json"), "utf8"),
  ]);
  const brand = JSON.parse(brandSource) as {
    channels: Record<string, { firefoxExtensionId: string }>;
  };
  const notifications = JSON.parse(notificationsSource) as {
    notifications: Array<{
      id: string;
      title: { en: string };
      message: { en: string[] };
    }>;
  };
  const rename = notifications.notifications.find(
    (notification) => notification.id === "privacy-thing-rename",
  );
  if (!rename?.message.en[0]) {
    throw new Error("privacy-thing-rename notification is incomplete");
  }

  return {
    notification: [rename.title.en, rename.message.en[0]],
    firefoxManifest: Object.values(brand.channels).map(
      ({ firefoxExtensionId }) => firefoxExtensionId,
    ),
  };
};

export const findRetiredBuildLeaks = async (target: BuildTarget): Promise<string[]> => {
  const root = path.resolve("build", target);
  const approved = await readApprovedBuildStrings();
  const findings: string[] = [];

  for (const absolutePath of await collectFiles(root)) {
    const relativePath = path.relative(root, absolutePath);
    if (retiredNamePattern.test(relativePath)) {
      findings.push(`${relativePath}: retired name in filename`);
    }

    let source = await readFile(absolutePath, "utf8");
    const allowedValues = [
      ...approved.notification,
      ...(target === "firefox" && relativePath === "manifest.json"
        ? approved.firefoxManifest
        : []),
    ];
    for (const value of allowedValues) {
      source = source.replaceAll(value, "");
    }
    if (retiredNamePattern.test(source)) {
      findings.push(`${relativePath}: retired name in content`);
    }
  }

  return findings;
};
