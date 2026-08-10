import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PRODUCT_PLACEHOLDER = "{{PRODUCT_NAME}}";
const BRAND_CONFIG_PATH = path.resolve("config/brand-config.json");
const LEGAL_TEMPLATES_DIR = path.resolve("scripts/legal-templates");
const PROJECT_LEGAL_DIR = path.join("licenses", "privacything");

const PROJECT_LEGAL_OUTPUTS = [
  ["LICENSE.md", "LICENSE.md"],
  ["COMMERCIAL_LICENSE.md", path.join(PROJECT_LEGAL_DIR, "COMMERCIAL_LICENSE.md")],
  ["NOTICE.md", "NOTICE.md"],
  ["BRANDING.md", path.join(PROJECT_LEGAL_DIR, "BRANDING.md")],
];

// Remove paths produced by older generator layouts and the historical misspelling.
const LEGACY_LEGAL_OUTPUTS = [
  path.resolve("COMERCIAL_LICENSE.md"),
  path.resolve("COMMERCIAL_LICENSE.md"),
  path.resolve("licenses", "privacything", "COMERCIAL_LICENSE.md"),
  path.resolve("licenses", "privacything", "NOTICE.md"),
  path.resolve("BRANDING.md"),
];

const parseArgs = (argv) => {
  const args = {
    outputRoot: "",
    productName: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--product-name") {
      args.productName = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--output-root") {
      args.outputRoot = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
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
};

const readBrandMetadata = () => {
  const brandConfig = JSON.parse(readTextFile(BRAND_CONFIG_PATH));
  const displayName =
    typeof brandConfig.displayName === "string" ? brandConfig.displayName.trim() : "";

  if (!displayName) {
    throw new Error(`config/brand-config.json is missing a non-empty displayName.`);
  }
  return { displayName };
};

const renderTemplate = (templateContent, productName) => {
  const rendered =
    templateContent.replaceAll(PRODUCT_PLACEHOLDER, productName).trimEnd() + "\n";

  if (rendered.includes(PRODUCT_PLACEHOLDER)) {
    throw new Error("A legal template still contains an unresolved brand placeholder.");
  }

  return rendered;
};

const resolveOutputPath = (outputRelativePath, outputRoot) =>
  outputRoot
    ? path.join(outputRoot, outputRelativePath)
    : path.resolve(outputRelativePath);

const materializeTemplate = ({
  outputRoot,
  templateRelativePath,
  outputRelativePath,
  productName,
}) => {
  const templatePath = path.join(LEGAL_TEMPLATES_DIR, templateRelativePath);
  const outputPath = resolveOutputPath(outputRelativePath, outputRoot);
  const templateContent = readTextFile(templatePath);
  writeTextFile(outputPath, renderTemplate(templateContent, productName));
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const brandMetadata = readBrandMetadata();
  const productName = args.productName.trim() || brandMetadata.displayName;

  if (!args.outputRoot) {
    for (const legacyPath of LEGACY_LEGAL_OUTPUTS) {
      fs.rmSync(legacyPath, { force: true });
    }
  }

  for (const [templateRelativePath, outputRelativePath] of PROJECT_LEGAL_OUTPUTS) {
    materializeTemplate({
      outputRoot: args.outputRoot,
      templateRelativePath,
      outputRelativePath,
      productName,
    });
  }
};

main();
