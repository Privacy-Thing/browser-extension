import { describe, expect, it } from "vitest";

import { promoteUnreleasedSection } from "../../scripts/promote-unreleased-changelog.mjs";

describe("promoteUnreleasedSection", () => {
  it("promotes the unreleased section into a release section", () => {
    const source = `# Changelog

## [Unreleased]

### Changed
- Updated the thing.

## [0.4.9] - 2026-03-30

### Fixed
- Earlier fix.
`;

    expect(promoteUnreleasedSection(source, "0.5.0", "2026-03-31")).toBe(`# Changelog

## [Unreleased]

## [0.5.0] - 2026-03-31

### Changed
- Updated the thing.

## [0.4.9] - 2026-03-30

### Fixed
- Earlier fix.
`);
  });

  it("rejects an empty unreleased section", () => {
    expect(() =>
      promoteUnreleasedSection(
        `# Changelog

## [Unreleased]

## [0.4.9] - 2026-03-30
`,
        "0.5.0",
        "2026-03-31",
      ),
    ).toThrow(/empty/);
  });
});
