import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "@playwright/test";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const brandingDir = path.join(rootDir, "assets", "branding");
const stableIconsDir = path.join(publicDir, "icons");
const betaBrandingDir = path.join(brandingDir, "beta");
const betaIconsDir = path.join(stableIconsDir, "beta");

const variants = [
  {
    sourceName: "privacything-icon-neutral.svg",
    prefix: "icon",
  },
  {
    sourceName: "privacything-icon-neutral.svg",
    prefix: "icon-theme-dark",
    colorScheme: "light",
  },
  {
    sourceName: "privacything-icon-neutral.svg",
    prefix: "icon-theme-light",
    colorScheme: "dark",
  },
  {
    sourceName: "privacything-icon-active.svg",
    prefix: "icon-active",
  },
  {
    sourceName: "privacything-icon-attention.svg",
    prefix: "icon-attention-1",
    imageStyle:
      "transform:scale(.88);filter:drop-shadow(0 0 1px #fbbf24) brightness(1.04);",
  },
  {
    sourceName: "privacything-icon-attention.svg",
    prefix: "icon-attention-2",
    imageStyle:
      "transform:scale(.78);filter:drop-shadow(0 0 3px #fbbf24) brightness(1.15);",
  },
  {
    sourceName: "privacything-icon-attention.svg",
    prefix: "icon-attention",
    imageStyle:
      "transform:scale(.84);filter:drop-shadow(0 0 2px #fbbf24) brightness(1.08);",
  },
  {
    sourceName: "privacything-icon-neutral.svg",
    prefix: "icon-unsupported",
    imageStyle: "filter: grayscale(1);",
  },
  {
    sourceName: "privacything-icon-off.svg",
    prefix: "icon-off",
  },
];

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const channelConfigs = [
  {
    brandingDir,
    iconsDir: stableIconsDir,
  },
  {
    brandingDir: betaBrandingDir,
    iconsDir: betaIconsDir,
  },
];

const sizes = [16, 32, 48, 128];

for (const channelConfig of channelConfigs) {
  await mkdir(channelConfig.iconsDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: {
      width: 256,
      height: 256,
    },
  });

  for (const channelConfig of channelConfigs) {
    for (const variant of variants) {
      const primarySource = path.join(channelConfig.brandingDir, variant.sourceName);
      const sourcePath = primarySource;
      if (!(await fileExists(sourcePath))) {
        throw new Error(`Missing Privacy Thing source icon: ${sourcePath}`);
      }
      const svgSource = await readFile(sourcePath, "utf8");
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSource)}`;
      for (const size of sizes) {
        await page.emulateMedia({ colorScheme: variant.colorScheme ?? "light" });
        await page.setViewportSize({
          width: size,
          height: size,
        });

        await page.setContent(`
          <!doctype html>
          <html>
            <body style="margin:0;background:transparent;display:grid;place-items:center;width:${size}px;height:${size}px;overflow:hidden;">
              <img src="${svgDataUrl}" width="${size}" height="${size}" alt="" style="display:block;${variant.imageStyle ?? ""}" />
            </body>
          </html>
        `);

        await page.screenshot({
          path: path.join(channelConfig.iconsDir, `${variant.prefix}-${size}.png`),
          omitBackground: true,
        });
      }
    }
  }
} finally {
  await browser.close();
}
