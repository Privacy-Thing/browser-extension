import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CONTROL_D_MARKERS = [
  "Control D",
  "ControlD",
  "controld.com",
  "control-d",
  "pt.control-d",
  "experimental/control-d",
] as const;

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
};

export const findControlDReleaseLeaks = async (
  target: "chrome" | "firefox",
): Promise<Array<{ file: string; marker: string }>> => {
  const root = path.resolve(process.cwd(), "build", target);
  const files = await listFiles(root);
  const leaks: Array<{ file: string; marker: string }> = [];

  for (const file of files) {
    const content = await readFile(file);
    const text = content.toString("utf8");
    for (const marker of CONTROL_D_MARKERS) {
      if (text.includes(marker)) {
        leaks.push({ file: path.relative(root, file), marker });
      }
    }
  }
  return leaks;
};
