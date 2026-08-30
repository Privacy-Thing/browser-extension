import { describe, expect, it } from "vitest";

import { insertMetadataSection } from "../../scripts/insert-metadata-release-changelog.mjs";
import { promoteUnreleasedSection } from "../../scripts/promote-unreleased-changelog.mjs";

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

### Changed
- In-progress feature work.

## [0.8.10.1] - 2026-06-23

- Refreshed data.

## [0.8.10] - 2026-06-21

### Fixed
- Earlier fix.
`);
  });

  it("keeps the in-progress Unreleased notes intact", () => {
    const result = insertMetadataSection(SOURCE, "0.8.10.1", "2026-06-23");

    expect(result).toContain("- In-progress feature work.");
    expect(result.indexOf("## [Unreleased]")).toBeLessThan(
      result.indexOf("- In-progress feature work."),
    );
    expect(result.indexOf("- In-progress feature work.")).toBeLessThan(
      result.indexOf("## [0.8.10.1]"),
    );
    expect(result.indexOf("## [0.8.10.1]")).toBeLessThan(result.indexOf("## [0.8.10]"));
  });

  it("keeps Unreleased promotable after inserting a metadata revision", () => {
    const withRevision = insertMetadataSection(
      SOURCE,
      "0.8.10.1",
      "2026-06-23",
      "- Refreshed data.",
    );
    const promoted = promoteUnreleasedSection(withRevision, "0.9.0", "2026-06-24");

    expect(promoted).toContain(`## [Unreleased]

## [0.9.0] - 2026-06-24

### Changed
- In-progress feature work.

## [0.8.10.1] - 2026-06-23

- Refreshed data.`);
  });

  it("supports an Unreleased header at the end of the changelog", () => {
    expect(
      insertMetadataSection("# Changelog\n\n## [Unreleased]", "0.8.10.1", "2026-06-23"),
    ).toContain("## [Unreleased]\n\n## [0.8.10.1] - 2026-06-23");
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
