import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const storybookRoot = path.join(repositoryRoot, "build/storybook-static");

const outputFlagIndex = process.argv.indexOf("--output");
const outputArgument =
  outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : undefined;
const outputDirectory = outputArgument
  ? path.resolve(process.cwd(), outputArgument)
  : path.join(repositoryRoot, "build/website-screenshots");

const captures = [
  {
    name: "regional-presets",
    storyId: "options-surface-states--locations",
    viewport: { width: 1280, height: 900 },
    capture: { kind: "viewport" },
    expectedWidth: 2560,
    expectedHeight: 1800,
    requiredText: ["Regional Presets", "Warsaw", "New York", "Sydney"],
  },
  {
    name: "edit-regional-preset",
    storyId: "options-surface-states--regional-preset-editor",
    viewport: { width: 1280, height: 900 },
    capture: { kind: "viewport" },
    expectedWidth: 2560,
    expectedHeight: 1800,
    requiredText: ["Edit preset", "Warsaw", "Geolocation", "Time & language"],
    requiredSelectors: [
      "#profile-generator-map canvas.maplibregl-canvas",
      "#profile-generator-map .profile-map-pin",
      '#profile-generator-map[data-map-ready="true"]',
    ],
    requiredSelectorTimeout: 90_000,
    forbiddenText: ["Map disabled"],
  },
  {
    name: "domain-rules",
    storyId: "options-surface-states--rules",
    viewport: { width: 1280, height: 900 },
    capture: { kind: "viewport" },
    expectedWidth: 2560,
    expectedHeight: 1800,
    requiredText: ["Domain Rules", "cnn.com", "allegro.pl", "cloudflare.com"],
  },
  {
    name: "edit-domain-rule",
    storyId: "options-surface-states--domain-rule-editor",
    viewport: { width: 1280, height: 900 },
    capture: { kind: "viewport" },
    expectedWidth: 2560,
    expectedHeight: 1800,
    requiredText: ["Edit rule", "cloudflare.com", "New York", "Protection settings"],
  },
  {
    name: "firefox-containers",
    storyId: "options-surface-states--firefox-containers",
    viewport: { width: 1280, height: 900 },
    capture: { kind: "viewport" },
    expectedWidth: 2560,
    expectedHeight: 1800,
    requiredText: ["Containers", "Personal", "Work", "Shopping", "Banking"],
  },
  {
    name: "general-options",
    storyId: "options-surface-states--options-chromium",
    viewport: { width: 1280, height: 900 },
    capture: { kind: "viewport" },
    expectedWidth: 2560,
    expectedHeight: 1800,
    requiredText: ["Global protection settings", "Geolocation", "Time & Locale"],
  },
  {
    name: "current-site",
    storyId: "popup-functional-app--interactive",
    viewport: { width: 900, height: 760 },
    args: "viewport:compact;showWorkbench:false",
    capture: { kind: "locator", selector: ".gw-popup-shell" },
    expectedWidth: 720,
    requiredText: ["cnn.com", "Domain Rule", "Warsaw", "Protected"],
  },
  {
    name: "protection-details",
    storyId: "popup-functional-app--protection-details-sidecar",
    viewport: { width: 900, height: 760 },
    capture: { kind: "locator", selector: ".gw-popup-layout" },
    expectedWidth: 1440,
    expectedHeight: 1200,
    captureStyle: ".gw-popup-workspace { outline: none !important; }",
    requiredText: [
      "cnn.com",
      "Protection details",
      "Geolocation",
      "Canvas",
    ],
  },
  {
    name: "x-ray",
    storyId: "sidebar-xray--active",
    viewport: { width: 360, height: 650 },
    capture: { kind: "viewport" },
    expectedWidth: 720,
    requiredText: ["X-Ray", "allegro.pl", "PAGE ACTIVITY", "Warsaw, Poland"],
  },
];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const captureFreezeStyle = `
  *, *::before, *::after {
    animation: none !important;
    caret-color: transparent !important;
    transition: none !important;
  }
`;

const pngDimensions = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const serveStorybook = async () => {
  await stat(path.join(storybookRoot, "iframe.html"));

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const relativePath =
        decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "") || "index.html";
      let filePath = path.resolve(storybookRoot, relativePath);

      if (
        filePath !== storybookRoot &&
        !filePath.startsWith(`${storybookRoot}${path.sep}`)
      ) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const fileStats = await stat(filePath);
      if (fileStats.isDirectory()) filePath = path.join(filePath, "index.html");

      const body = await readFile(filePath);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type":
          contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not resolve the Storybook server address.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};

const storyUrl = (origin, capture, theme) => {
  const parameters = new URLSearchParams({
    id: capture.storyId,
    viewMode: "story",
    globals: `theme:${theme}`,
  });
  if (capture.args) parameters.set("args", capture.args);
  return `${origin}/iframe.html?${parameters.toString()}`;
};

const waitForStory = async (page, capture, theme) => {
  await page.locator("#storybook-root").waitFor({ state: "visible" });
  await page.waitForFunction(
    (expectedTheme) => document.documentElement.dataset.theme === expectedTheme,
    theme,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            }),
        ),
    );
  });

  for (const text of capture.requiredText) {
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
  }

  for (const selector of capture.requiredSelectors ?? []) {
    await page.locator(selector).first().waitFor({
      state: "visible",
      timeout: capture.requiredSelectorTimeout,
    });
  }

  for (const text of capture.forbiddenText ?? []) {
    if (await page.getByText(text, { exact: false }).count()) {
      throw new Error(`${capture.name}-${theme} unexpectedly contains "${text}".`);
    }
  }

  await page.addStyleTag({
    content: [captureFreezeStyle, capture.captureStyle].filter(Boolean).join("\n"),
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
};

const renderCapture = async (browser, origin, capture, theme) => {
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    viewport: capture.viewport,
  });
  const page = await context.newPage();
  await page.addInitScript((content) => {
    const style = document.createElement("style");
    style.dataset.websiteScreenshotFreeze = "";
    style.textContent = content;
    document.documentElement.append(style);
  }, captureFreezeStyle);
  const diagnostics = [];
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.push(error.message));

  try {
    await page.goto(storyUrl(origin, capture, theme), { waitUntil: "load" });
    await waitForStory(page, capture, theme);

    if (capture.capture.kind === "locator") {
      return await page.locator(capture.capture.selector).screenshot({
        animations: "disabled",
        scale: "device",
      });
    }

    return await page.screenshot({
      animations: "disabled",
      fullPage: capture.capture.kind === "full-page",
      scale: "device",
    });
  } catch (error) {
    if (diagnostics.length > 0) {
      console.error(
        `[website-screenshots] ${capture.name}-${theme} browser errors:\n${diagnostics.join("\n")}`,
      );
    }
    throw error;
  } finally {
    await context.close();
  }
};

const main = async () => {
  await mkdir(outputDirectory, { recursive: true });
  const server = await serveStorybook();
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const manifest = {};

  try {
    for (const capture of captures) {
      const variants = {};

      for (const theme of ["light", "dark"]) {
        const buffer = await renderCapture(browser, server.origin, capture, theme);
        const dimensions = pngDimensions(buffer);
        if (
          dimensions.width !== capture.expectedWidth ||
          (capture.expectedHeight && dimensions.height !== capture.expectedHeight)
        ) {
          throw new Error(
            `${capture.name}-${theme}.png is ${dimensions.width}x${dimensions.height}px; expected ${capture.expectedWidth}x${capture.expectedHeight ?? "auto"}px.`,
          );
        }

        const fileName = `${capture.name}-${theme}.png`;
        await writeFile(path.join(outputDirectory, fileName), buffer);
        variants[theme] = {
          file: fileName,
          ...dimensions,
          sha256: sha256(buffer),
        };
        console.log(
          `[website-screenshots] ${fileName} ${dimensions.width}x${dimensions.height}`,
        );
      }

      if (
        variants.light.width !== variants.dark.width ||
        variants.light.height !== variants.dark.height
      ) {
        throw new Error(
          `${capture.name} light and dark captures have different dimensions.`,
        );
      }

      const defaultFileName = `${capture.name}.png`;
      await copyFile(
        path.join(outputDirectory, variants.dark.file),
        path.join(outputDirectory, defaultFileName),
      );
      manifest[capture.name] = {
        width: variants.light.width,
        height: variants.light.height,
        light: variants.light,
        dark: variants.dark,
        default: defaultFileName,
      };
    }

    await writeFile(
      path.join(outputDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(`[website-screenshots] Wrote captures to ${outputDirectory}`);
};

main().catch((error) => {
  console.error("[website-screenshots] Capture failed.");
  console.error(error);
  process.exitCode = 1;
});
