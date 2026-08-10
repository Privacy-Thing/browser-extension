import { describe, expect, it } from "vitest";

import { insertMetadataSection } from "../../scripts/insert-metadata-release-changelog.mjs";

const SOURCE = `# Changelog

## [Unreleased]

### Changed
- In-progress feature work.

## [0.8.10] - 2026-06-21

### Fixed
- Earlier fix.
`;

describe("insertMetadataReleaseSection", () => {
  it("inserts a dated revision section without draining Unreleased", () => {
    const result = insertMetadataSection(
      SOURCE,
      "0.8.10.1",
      "2026-06-23",
      "- Refreshed data.",
    );

    expect(result).toBe(`# Changelog

## [Unreleased]

## [0.8.10.1] - 2026-06-23

- Refreshed data.

### Changed
- In-progress feature work.

## [0.8.10] - 2026-06-21

### Fixed
- Earlier fix.
`);
  });

  it("keeps the in-progress Unreleased notes intact", () => {
    const result = insertMetadataSection(SOURCE, "0.8.10.1", "2026-06-23");

    expect(result).toContain("- In-progress feature work.");
    expect(result.indexOf("## [Unreleased]")).toBeLessThan(
      result.indexOf("## [0.8.10.1]"),
    );
    expect(result.indexOf("## [0.8.10.1]")).toBeLessThan(result.indexOf("## [0.8.10]"));
  });

  it("rejects an invalid version", () => {
    expect(() => insertMetadataSection(SOURCE, "0.8", "2026-06-23")).toThrow(
      /Invalid version/,
    );
  });

  it("rejects an invalid date", () => {
    expect(() => insertMetadataSection(SOURCE, "0.8.10.1", "June 23")).toThrow(
      /Invalid date/,
    );
  });

  it("throws when the Unreleased section is missing", () => {
    expect(() =>
      insertMetadataSection("# Changelog\n", "0.8.10.1", "2026-06-23"),
    ).toThrow(/Unreleased/);
  });
});
