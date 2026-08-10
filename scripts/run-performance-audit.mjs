#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

const root = process.cwd();
const extensionPath = path.join(root, "build", "chrome");
const outputDirectory = path.join(root, "build", "perf-audit");

const startHost = async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Privacy Thing performance audit</title>");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve the local performance-audit host.");
  }

  return {
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    url: `http://127.0.0.1:${address.port}`,
  };
};

const MEASURE_SCRIPT = `
  async () => {
    const SAMPLE_COUNT = 5;
    const WARMUP_COUNT = 1;
    const summarize = (samples) => {
      const sorted = [...samples].sort((left, right) => left - right);
      return {
        maxMs: sorted.at(-1),
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      };
    };
    const collect = (run) => {
      for (let index = 0; index < WARMUP_COUNT; index += 1) run();
      const samples = [];
      for (let index = 0; index < SAMPLE_COUNT; index += 1) {
        const startedAt = performance.now();
        run();
        samples.push(performance.now() - startedAt);
      }
      return summarize(samples);
    };
    const longTasks = [];
    const observer = typeof PerformanceObserver === "undefined" ? null : new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) longTasks.push(entry.duration);
    });
    observer?.observe({ type: "longtask", buffered: true });

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#204080";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const localeDate = new Date();
    const dateIntl = collect(() => {
      for (let index = 0; index < 2_000; index += 1) {
        localeDate.toLocaleString("en-US");
      }
    });
    const canvasExport = collect(() => canvas.toDataURL("image/png"));
    const canvasReadback = collect(() => context.getImageData(0, 0, canvas.width, canvas.height));

    const glCanvas = document.createElement("canvas");
    const gl = glCanvas.getContext("webgl2") ?? glCanvas.getContext("webgl");
    const webglReadPixels = gl
      ? collect(() => gl.readPixels(0, 0, 1024, 1024, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4 * 1024 * 1024)))
      : null;
    const workerConstruct = collect(() => {
      const workerUrl = URL.createObjectURL(
        new Blob(["self.onmessage = () => {}"], { type: "text/javascript" })
      );
      const worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
    });
    const manyFrames = collect(() => {
      const container = document.createElement("div");
      for (let index = 0; index < 24; index += 1) {
        const frame = document.createElement("iframe");
        frame.src = "about:blank";
        container.append(frame);
      }
      document.body.append(container);
      container.remove();
    });

    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    observer?.disconnect();
    return {
      dateIntl,
      canvasExport,
      canvasReadback,
      webglReadPixels,
      workerConstruct,
      manyFrames,
      longTasksMs: longTasks
    };
  }
`;

const measure = async (page) => page.evaluate(`(${MEASURE_SCRIPT})()`);

const createComparison = (baseline, spoofed) => {
  const metrics = {};
  for (const [name, active] of Object.entries(spoofed)) {
    const native = baseline[name];
    if (!native?.medianMs || !active?.medianMs) continue;
    metrics[name] = {
      baselineMedianMs: native.medianMs,
      baselineP95Ms: native.p95Ms,
      deltaMedianMs: active.medianMs - native.medianMs,
      deltaP95Ms: active.p95Ms - native.p95Ms,
      spoofedMedianMs: active.medianMs,
      spoofedP95Ms: active.p95Ms,
    };
  }
  return {
    longTasks: {
      baselineCount: baseline.longTasksMs.length,
      spoofedCount: spoofed.longTasksMs.length,
    },
    metrics,
  };
};

const configureExtension = async (context, extensionId, hostname) => {
  const options = await context.newPage();
  try {
    await options.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
    const response = await options.evaluate(
      async ({ hostname }) => {
        const location = {
          id: "performance-audit",
          label: "Performance audit",
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 20,
          noiseRadius: 50,
          language: "pl",
          languages: ["pl", "en-US"],
          timeZone: "America/New_York",
        };
        const model = await chrome.runtime.sendMessage({
          type: "pt:save-location-model",
          locations: [location],
          rules: [{ pattern: hostname, locationId: location.id, enabled: true }],
          containerAssignments: [],
        });
        const settings = await chrome.runtime.sendMessage({
          type: "pt:save-simple-settings",
          onboardingCompleted: true,
          browserFingerprintSpoofingEnabled: true,
          sharedSpoofing: {
            audio: true,
            canvas: true,
            screen: true,
            webGL: true,
            webRTC: true,
          },
        });
        return { model, settings };
      },
      { hostname },
    );
    if (!response.model?.ok || !response.settings?.ok) {
      throw new Error(
        response.model?.error ??
          response.settings?.error ??
          "Performance-audit setup failed.",
      );
    }
  } finally {
    await options.close();
  }
};

const main = async () => {
  const host = await startHost();
  const baselineBrowser = await chromium.launch({
    channel: "chromium",
    headless: true,
  });
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pt-perf-audit-"));
  let extensionContext;

  try {
    const baselinePage = await baselineBrowser.newPage();
    await baselinePage.goto(host.url);
    const baseline = await measure(baselinePage);

    extensionContext = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    const serviceWorker =
      extensionContext.serviceWorkers()[0] ??
      (await extensionContext.waitForEvent("serviceworker"));
    const extensionId = new URL(serviceWorker.url()).host;
    await configureExtension(extensionContext, extensionId, new URL(host.url).hostname);

    const spoofedPage = await extensionContext.newPage();
    await spoofedPage.goto(host.url);
    await spoofedPage.waitForFunction(() => navigator.language === "pl", undefined, {
      timeout: 10_000,
    });
    const spoofed = await measure(spoofedPage);
    const report = {
      baseline,
      comparison: createComparison(baseline, spoofed),
      generatedAt: new Date().toISOString(),
      spoofed,
      target: "chromium",
    };

    await mkdir(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, `audit-${Date.now()}.json`);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `Privacy Thing performance audit written to ${path.relative(root, outputPath)}`,
    );
    console.table(report.comparison.metrics);
    console.log("Long Tasks", report.comparison.longTasks);
  } finally {
    await extensionContext?.close();
    await baselineBrowser.close();
    await rm(userDataDir, { force: true, recursive: true });
    await host.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
