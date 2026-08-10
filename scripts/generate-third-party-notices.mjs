import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_OUTPUT_PATH = path.resolve(
  "licenses",
  "privacything",
  "THIRD_PARTY_NOTICES.md",
);
const DEFAULT_LICENSES_DIR = path.resolve("licenses");
const CC_BY_4_0_TEMPLATE_PATH = path.resolve(
  "scripts/third-party-license-templates/CC-BY-4.0.txt",
);
const BRAND_CONFIG_PATH = path.resolve("config/brand-config.json");
const LEGAL_TEMPLATES_DIR = path.resolve("scripts/legal-templates");
const THIRD_PARTY_HEADER_PATH = path.join(
  LEGAL_TEMPLATES_DIR,
  "THIRD_PARTY_NOTICES_HEADER.md",
);
const AGPL_3_0_TEMPLATE_PATH = path.join(
  LEGAL_TEMPLATES_DIR,
  "licenses",
  "AGPL-3.0.txt",
);
const LEGACY_OUTPUT_PATH = path.resolve("THIRD_PARTY_NOTICES.md");

const LICENSE_FILE_PATTERN = /^(license|licence|copying|copyright)(\.[^.]+)?$/i;

// Packages published by the project's own copyright holder. They ship inside the
// product and are covered by the product's license, so they are deliberately
// absent from the third-party notices.
const FIRST_PARTY_SCOPES = ["@privacy-thing/", "@privacy-brand/"];

const isFirstPartyPackage = (packageName) =>
  FIRST_PARTY_SCOPES.some((scope) => packageName.startsWith(scope));

const PACKAGE_OVERRIDES = {
  "@fortawesome/fontawesome-free": {
    groupKey: "font-awesome-free",
    renderer: "font-awesome",
    title: "Font Awesome Free",
  },
  "@radix-ui/react-dialog": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-dropdown-menu": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-popover": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-progress": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-select": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-separator": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-slider": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-switch": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-tabs": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  "@radix-ui/react-tooltip": {
    groupKey: "radix-ui-primitives",
    renderer: "radix",
    title: "Radix UI Primitives",
  },
  react: {
    groupKey: "react",
    renderer: "react",
    title: "React",
  },
  "react-dom": {
    groupKey: "react",
    renderer: "react",
    title: "React",
  },
  "class-variance-authority": {
    renderer: "apache",
    title: "Class Variance Authority",
  },
  clsx: {
    title: "clsx",
  },
  cmdk: {
    title: "cmdk",
  },
  "maplibre-gl": {
    renderer: "maplibre",
    title: "MapLibre GL JS",
  },
  "tailwind-merge": {
    title: "tailwind-merge",
  },
  "tz-lookup": {
    renderer: "tz-lookup",
    title: "tz-lookup",
  },
  zod: {
    title: "Zod",
  },
};

const parseArgs = (argv) => {
  const args = {
    licensesEmbedPath: "licenses",
    noLegacyCleanup: false,
    strict: false,
    outputPath: DEFAULT_OUTPUT_PATH,
    licensesDirectory: DEFAULT_LICENSES_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--strict") {
      args.strict = true;
      continue;
    }

    if (value === "--no-legacy-cleanup") {
      args.noLegacyCleanup = true;
      continue;
    }

    if (value === "--output") {
      args.outputPath = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (value === "--licenses-dir") {
      args.licensesDirectory = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (value === "--licenses-embed-path") {
      args.licensesEmbedPath = (argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!args.outputPath) {
    throw new Error("Use --output <path>");
  }

  if (!args.licensesDirectory) {
    throw new Error("Use --licenses-dir <path>");
  }

  if (!args.licensesEmbedPath) {
    throw new Error("Use --licenses-embed-path <path>");
  }

  return args;
};

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
};

const readTextFile = (filePath) => fs.readFileSync(filePath, "utf8");

const writeTextFile = (filePath, content) => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
};

const copyFile = (sourcePath, destinationPath) => {
  ensureDirectory(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
  return destinationPath;
};

const readRootPackageManifest = () =>
  JSON.parse(readTextFile(path.resolve("package.json")));

const readBrandDisplayName = () => {
  const brandConfig = JSON.parse(readTextFile(BRAND_CONFIG_PATH));
  const displayName =
    typeof brandConfig.displayName === "string" ? brandConfig.displayName.trim() : "";

  if (!displayName) {
    throw new Error("config/brand-config.json is missing a non-empty displayName.");
  }

  return displayName;
};

const runPnpmLicenses = () => {
  const result = spawnSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        `pnpm licenses list exited with code ${result.status ?? 1}`,
    );
  }

  return JSON.parse(result.stdout);
};

const readPackageManifest = (packagePath) =>
  JSON.parse(readTextFile(path.join(packagePath, "package.json")));

const collectTopFileMatches = (packagePath, pattern) =>
  fs
    .readdirSync(packagePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

const findSingleLicenseFile = (packagePath, packageName) => {
  const matches = collectTopFileMatches(packagePath, LICENSE_FILE_PATTERN);

  if (matches.length === 0) {
    throw new Error(`${packageName} does not expose a top-level license file.`);
  }

  return matches[0];
};

const normalizeAuthor = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object" && typeof value.name === "string") {
    const extras = [value.email, value.url].filter(
      (item) => typeof item === "string" && item,
    );
    return extras.length > 0 ? `${value.name} (${extras.join(", ")})` : value.name;
  }

  return "";
};

const sanitizeBasename = (value) =>
  value
    .replaceAll(/[^A-Za-z0-9._-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");

const formatPackageTitle = (packageName) =>
  packageName
    .replace(/^@[^/]+\//, "")
    .split(/[-_/]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildRelativeLicensePath = (licensesEmbedPath, fileName) =>
  path.posix.join(licensesEmbedPath.replaceAll(path.sep, "/"), fileName);

const extractCopyrightBlock = (licenseText) => {
  const lines = licenseText.replaceAll("\r\n", "\n").split("\n");
  const startIndex = lines.findIndex((line) =>
    /^Copyright(?:\s|\()/u.test(line.trim()),
  );

  if (startIndex < 0) {
    return "";
  }

  const collected = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    const normalized = line.trim();

    if (index > startIndex && normalized === "") {
      break;
    }

    if (
      index > startIndex &&
      /^(Permission is hereby granted|Redistribution and use|All rights reserved\.|Apache License|CC0 1\.0 Universal|Creative Commons Attribution 4\.0 International|SIL OPEN FONT LICENSE)\b/.test(
        normalized,
      )
    ) {
      break;
    }

    collected.push(line);
  }

  return collected.join("\n").trim();
};

const extractFontAwesomeOfl = (licenseText) => {
  const startIndex = licenseText.indexOf("SIL OPEN FONT LICENSE");
  const endIndex = licenseText.indexOf(
    "\n--------------------------------------------------------------------------------\n\n# Code: MIT License",
  );

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error("Could not extract the Font Awesome OFL section.");
  }

  return `${licenseText.slice(startIndex, endIndex).trim()}\n`;
};

const buildDirectPackageMap = () => {
  const directDependencies = Object.keys(readRootPackageManifest().dependencies ?? {});
  const groupedPackages = runPnpmLicenses();
  const entriesByName = new Map();

  for (const entries of Object.values(groupedPackages)) {
    for (const entry of entries) {
      entriesByName.set(entry.name, entry);
    }
  }

  return new Map(
    directDependencies.map((packageName) => {
      const entry = entriesByName.get(packageName);
      if (!entry) {
        throw new Error(`pnpm licenses list did not report ${packageName}.`);
      }

      const versions = Array.isArray(entry.versions)
        ? entry.versions.filter(Boolean)
        : [];
      const packagePaths = Array.isArray(entry.paths)
        ? entry.paths.filter(Boolean)
        : [];

      if (versions.length !== 1 || packagePaths.length !== 1) {
        throw new Error(
          `${packageName} should resolve to exactly one installed direct dependency, got versions=${versions.length} paths=${packagePaths.length}.`,
        );
      }

      const packagePath = packagePaths[0];
      const manifest = readPackageManifest(packagePath);

      return [
        packageName,
        {
          name: packageName,
          version: versions[0],
          packagePath,
          manifest,
          homepage: manifest.homepage || entry.homepage || "",
          author: normalizeAuthor(manifest.author),
          license:
            typeof manifest.license === "string"
              ? manifest.license
              : entry.license || "",
        },
      ];
    }),
  );
};

const renderSection = (section) => {
  const lines = [
    `## ${section.title}`,
    "",
    ...section.metadataLines,
    "",
    ...section.bodyLines,
  ];
  return lines.join("\n").trimEnd();
};

const createSimpleSection = ({
  title,
  packageNames,
  packageLabel,
  website,
  copyright,
  author,
  sentence,
  licensePaths,
}) => {
  const metadataLines = [
    `${packageNames.length > 1 ? "Packages" : "Package"}: ${packageNames.map((name) => `\`${name}\``).join(", ")}`,
    ...(copyright ? [copyright] : author ? [`Author: ${author}`] : []),
    ...(website ? [`Website: ${website}`] : []),
  ];

  return {
    title,
    metadataLines,
    bodyLines: [
      sentence || `${packageLabel} is licensed under its upstream license.`,
      "",
      "Full license text:",
      ...licensePaths.map((licensePath) => `See \`${licensePath}\``),
    ],
  };
};

const createFontAwesomeSection = ({ pkg, licensesDirectory, licensesEmbedPath }) => {
  const licenseFileName = findSingleLicenseFile(pkg.packagePath, pkg.name);
  const sourcePath = path.join(pkg.packagePath, licenseFileName);
  const sourceText = readTextFile(sourcePath);
  const fontAwesomeLicensePath = copyFile(
    sourcePath,
    path.join(licensesDirectory, "Font-Awesome-Free-LICENSE.txt"),
  );
  const ccByLicensePath = writeTextFile(
    path.join(licensesDirectory, "CC-BY-4.0.txt"),
    readTextFile(CC_BY_4_0_TEMPLATE_PATH).trimEnd() + "\n",
  );
  const oflLicensePath = writeTextFile(
    path.join(licensesDirectory, "OFL-1.1.txt"),
    extractFontAwesomeOfl(sourceText),
  );

  return {
    title: "Font Awesome Free",
    metadataLines: [
      "Package: `@fortawesome/fontawesome-free`",
      "Copyright (c) 2026 Fonticons, Inc. (https://fontawesome.com)",
      `Website: ${pkg.homepage}`,
    ],
    bodyLines: [
      "Font Awesome Free is licensed as follows:",
      "",
      "- Icons packaged as SVG and JS files: Creative Commons Attribution 4.0 International License (CC BY 4.0)",
      "- Fonts and webfont files: SIL Open Font License 1.1 (OFL-1.1)",
      "- Non-font and non-icon files: MIT License",
      "",
      "Full license text:",
      `See \`${buildRelativeLicensePath(licensesEmbedPath, path.basename(fontAwesomeLicensePath))}\``,
      `See \`${buildRelativeLicensePath(licensesEmbedPath, path.basename(ccByLicensePath))}\``,
      `See \`${buildRelativeLicensePath(licensesEmbedPath, path.basename(oflLicensePath))}\``,
    ],
  };
};

const createRadixSection = ({ packages, licensesDirectory, licensesEmbedPath }) => {
  const basePackage = packages[0];
  const licenseFileName = findSingleLicenseFile(
    basePackage.packagePath,
    basePackage.name,
  );
  const sourceText = readTextFile(path.join(basePackage.packagePath, licenseFileName));
  const copiedPath = copyFile(
    path.join(basePackage.packagePath, licenseFileName),
    path.join(licensesDirectory, "Radix-UI-Primitives-LICENSE.txt"),
  );

  return createSimpleSection({
    title: "Radix UI Primitives",
    packageNames: packages.map((pkg) => pkg.name),
    packageLabel: "The packages listed above",
    website: basePackage.homepage,
    copyright: extractCopyrightBlock(sourceText),
    author: basePackage.author,
    sentence: "The packages listed above are licensed under the MIT License.",
    licensePaths: [
      buildRelativeLicensePath(licensesEmbedPath, path.basename(copiedPath)),
    ],
  });
};

const createLicenseSection = ({
  title,
  pkg,
  destinationFileName,
  licensesDirectory,
  licensesEmbedPath,
  sentence,
  forceAuthorFallback = false,
}) => {
  const licenseFileName = findSingleLicenseFile(pkg.packagePath, pkg.name);
  const sourcePath = path.join(pkg.packagePath, licenseFileName);
  const sourceText = readTextFile(sourcePath);
  const copiedPath = copyFile(
    sourcePath,
    path.join(licensesDirectory, destinationFileName),
  );
  const copyright = forceAuthorFallback ? "" : extractCopyrightBlock(sourceText);

  return createSimpleSection({
    title,
    packageNames: [pkg.name],
    packageLabel: title,
    website: pkg.homepage,
    copyright,
    author: pkg.author,
    sentence,
    licensePaths: [
      buildRelativeLicensePath(licensesEmbedPath, path.basename(copiedPath)),
    ],
  });
};

const createMapLibreSection = ({ pkg, licensesDirectory, licensesEmbedPath }) => {
  const licenseFileName = findSingleLicenseFile(pkg.packagePath, pkg.name);
  const sourcePath = path.join(pkg.packagePath, licenseFileName);
  const sourceText = readTextFile(sourcePath);
  const copiedPath = copyFile(
    sourcePath,
    path.join(licensesDirectory, "maplibre-gl-LICENSE.txt"),
  );

  return createSimpleSection({
    title: "MapLibre GL JS",
    packageNames: [pkg.name],
    packageLabel: "MapLibre GL JS",
    website: pkg.homepage,
    copyright: extractCopyrightBlock(sourceText),
    author: pkg.author,
    sentence:
      "MapLibre GL JS ships a composite upstream license file that covers the core project and bundled third-party attributions from upstream components.",
    licensePaths: [
      buildRelativeLicensePath(licensesEmbedPath, path.basename(copiedPath)),
    ],
  });
};

const createPerPackageSection = ({
  title,
  pkg,
  destinationFileName,
  licensesDirectory,
  licensesEmbedPath,
  sentence,
}) => {
  const licenseFileName = findSingleLicenseFile(pkg.packagePath, pkg.name);
  const sourcePath = path.join(pkg.packagePath, licenseFileName);
  const sourceText = readTextFile(sourcePath);
  const copiedPath = copyFile(
    sourcePath,
    path.join(licensesDirectory, destinationFileName),
  );

  return createSimpleSection({
    title,
    packageNames: [pkg.name],
    packageLabel: title,
    website: pkg.homepage,
    copyright: extractCopyrightBlock(sourceText),
    author: pkg.author,
    sentence,
    licensePaths: [
      buildRelativeLicensePath(licensesEmbedPath, path.basename(copiedPath)),
    ],
  });
};

const createSectionGroups = (directPackages) => {
  const groups = [];
  const groupsByKey = new Map();

  for (const packageName of directPackages.keys()) {
    const override = PACKAGE_OVERRIDES[packageName];
    const groupKey = override?.groupKey ?? packageName;
    const existingGroup = groupsByKey.get(groupKey);

    if (existingGroup) {
      existingGroup.packageNames.push(packageName);
      continue;
    }

    const group = {
      groupKey,
      packageNames: [packageName],
      renderer: override?.renderer ?? "default",
      title: override?.title ?? formatPackageTitle(packageName),
    };

    groupsByKey.set(groupKey, group);
    groups.push(group);
  }

  return groups;
};

const buildSections = ({ directPackages, licensesDirectory, licensesEmbedPath }) => {
  const sections = [];
  const coveredPackages = new Set();

  for (const group of createSectionGroups(directPackages)) {
    const packages = group.packageNames.map((packageName) => {
      const pkg = directPackages.get(packageName);
      if (!pkg) {
        throw new Error(`Missing direct dependency metadata for ${packageName}.`);
      }
      coveredPackages.add(packageName);
      return pkg;
    });

    // First-party packages get no section. Third-party notices exist to discharge
    // obligations that other copyright holders impose; these share the project's
    // copyright holder and are covered by the product's own license, so listing
    // them here would assert a licensing relationship that does not exist.
    if (group.packageNames.every((packageName) => isFirstPartyPackage(packageName))) {
      continue;
    }

    if (group.renderer === "font-awesome") {
      sections.push(
        createFontAwesomeSection({
          pkg: packages[0],
          licensesDirectory,
          licensesEmbedPath,
        }),
      );
      continue;
    }

    if (group.renderer === "radix") {
      sections.push(
        createRadixSection({ packages, licensesDirectory, licensesEmbedPath }),
      );
      continue;
    }

    if (group.renderer === "apache") {
      sections.push(
        createLicenseSection({
          title: group.title,
          pkg: packages[0],
          destinationFileName: "Apache-2.0.txt",
          licensesDirectory,
          licensesEmbedPath,
          sentence:
            "Class Variance Authority is licensed under the Apache License 2.0.",
        }),
      );
      continue;
    }

    if (group.renderer === "maplibre") {
      sections.push(
        createMapLibreSection({
          pkg: packages[0],
          licensesDirectory,
          licensesEmbedPath,
        }),
      );
      continue;
    }

    if (group.renderer === "react") {
      sections.push(
        createPerPackageSection({
          title: "React",
          pkg: packages[0],
          destinationFileName: "React-LICENSE.txt",
          licensesDirectory,
          licensesEmbedPath,
          sentence: "The packages listed above are licensed under the MIT License.",
        }),
      );
      sections.at(-1).metadataLines[0] =
        `Packages: ${packages.map((pkg) => `\`${pkg.name}\``).join(", ")}`;
      continue;
    }

    if (group.renderer === "tz-lookup") {
      sections.push(
        createLicenseSection({
          title: group.title,
          pkg: packages[0],
          destinationFileName: "CC0-1.0.txt",
          licensesDirectory,
          licensesEmbedPath,
          sentence: "tz-lookup is published under the CC0 1.0 Universal dedication.",
          forceAuthorFallback: true,
        }),
      );
      continue;
    }

    sections.push(
      createPerPackageSection({
        title: group.title,
        pkg: packages[0],
        destinationFileName: `${sanitizeBasename(group.title)}-LICENSE.txt`,
        licensesDirectory,
        licensesEmbedPath,
        sentence: `${group.title} is licensed under the ${packages[0].license} license.`,
      }),
    );
  }

  const uncoveredPackages = [...directPackages.keys()].filter(
    (packageName) => !coveredPackages.has(packageName),
  );
  if (uncoveredPackages.length > 0) {
    throw new Error(
      `The following direct dependencies are not covered by the generator: ${uncoveredPackages.join(", ")}`,
    );
  }

  return sections;
};

const renderThirdPartyNotices = (sections) => {
  const brandDisplayName = readBrandDisplayName();
  const header = readTextFile(THIRD_PARTY_HEADER_PATH)
    .replaceAll("{{PRODUCT_NAME}}", brandDisplayName)
    .trim();
  const blocks = [header];

  for (const section of sections) {
    blocks.push(renderSection(section));
  }

  return `${blocks.join("\n\n-------------------------------------------------------------------------------\n\n")}\n`;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.noLegacyCleanup && fs.existsSync(args.licensesDirectory)) {
    for (const entry of fs.readdirSync(args.licensesDirectory, {
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".txt")) {
        fs.rmSync(path.join(args.licensesDirectory, entry.name), { force: true });
      }
    }
  }

  if (!args.noLegacyCleanup) {
    fs.rmSync(args.outputPath, { force: true });
  }
  if (!args.noLegacyCleanup && args.outputPath !== LEGACY_OUTPUT_PATH) {
    fs.rmSync(LEGACY_OUTPUT_PATH, { force: true });
  }
  ensureDirectory(args.licensesDirectory);
  writeTextFile(
    path.join(args.licensesDirectory, "AGPL-3.0.txt"),
    readTextFile(AGPL_3_0_TEMPLATE_PATH).trimEnd() + "\n",
  );

  const directPackages = buildDirectPackageMap();
  const sections = buildSections({
    directPackages,
    licensesDirectory: args.licensesDirectory,
    licensesEmbedPath: args.licensesEmbedPath,
  });
  const notices = renderThirdPartyNotices(sections);

  writeTextFile(args.outputPath, notices);

  const missingMetadataSections = sections.filter(
    (section) =>
      !section.metadataLines.some((line) => line.startsWith("Copyright")) &&
      !section.metadataLines.some((line) => line.startsWith("Author:")),
  );

  if (missingMetadataSections.length > 0) {
    const message = `Generated ${path.relative(process.cwd(), args.outputPath)} and ${path.relative(process.cwd(), args.licensesDirectory)} with ${missingMetadataSections.length} section(s) missing copyright/author metadata.`;
    if (args.strict) {
      throw new Error(message);
    }
    process.stderr.write(`${message}\n`);
  }
};

main();
