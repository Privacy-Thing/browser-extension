import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "vitest";

// Local builds expose source maps; release builds strip them. The dependency
// boundary is checked across every emitted chunk, including lazy UI chunks.
test.each(["chrome", "firefox"])(
  "keeps PSL and fencing resolution in the %s background bundle",
  async (target) => {
    const directory = path.resolve("build", target);
    const entries = await readdir(directory, { recursive: true });
    const maps = entries.filter((entry) => entry.endsWith(".js.map"));
    if (!maps.length) {
      expect(
        JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"))
          .version,
      ).toBeTruthy();
      return;
    }
    const carriers: string[] = [];
    for (const entry of maps) {
      const map = JSON.parse(await readFile(path.join(directory, entry), "utf8")) as {
        sources: string[];
      };
      if (
        map.sources.some((source) =>
          /tldts|background\/domain-fencing\.ts/.test(source),
        )
      ) {
        carriers.push(entry.replaceAll("\\", "/"));
      }
    }
    expect(carriers).toEqual(["assets/background.js.map"]);
  },
);
