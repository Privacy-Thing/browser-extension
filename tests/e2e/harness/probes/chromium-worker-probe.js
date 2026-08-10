/* global navigator, OffscreenCanvas, self */

self.addEventListener(
  "message",
  async (event) => {
    try {
      const hashBytes = (bytes) => {
        let hash = 2166136261;
        for (let index = 0; index < bytes.length; index += 1) {
          hash = Math.imul(hash ^ bytes[index], 16777619);
        }
        return hash >>> 0;
      };

      const sampleDate = new Date(Date.UTC(2020, 0, 15, 12, 0, 0));
      const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
        month: "long",
        timeZoneName: "short",
      });

      let clientHints = null;
      try {
        if (navigator.userAgentData) {
          const highEntropyValues = await navigator.userAgentData.getHighEntropyValues([
            "architecture",
            "bitness",
            "platformVersion",
            "model",
            "formFactors",
            "wow64",
            "fullVersionList",
            "uaFullVersion",
            "mobile",
            "platform",
          ]);
          clientHints = {
            brands: navigator.userAgentData.brands,
            mobile: navigator.userAgentData.mobile,
            platform: navigator.userAgentData.platform,
            highEntropyValues,
          };
        }
      } catch (error) {
        clientHints = {
          error: error instanceof Error ? error.message : String(error),
        };
      }

      let webGL = null;
      try {
        if (typeof OffscreenCanvas !== "undefined") {
          const canvas = new OffscreenCanvas(4, 4);
          const gl = canvas.getContext("webgl");
          if (gl) {
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0.25, 0.5, 0.75, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            const readPixels = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(
              0,
              0,
              canvas.width,
              canvas.height,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              readPixels,
            );
            webGL = {
              debugExtensionAvailable: debugInfo !== null,
              renderer: debugInfo
                ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                : null,
              vendor: debugInfo
                ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
                : null,
              supportedExtensions: gl.getSupportedExtensions(),
              readPixelsHash: hashBytes(readPixels),
              readPixelsSample: Array.from(readPixels),
            };
          }
        }
      } catch (error) {
        webGL = {
          error: error instanceof Error ? error.message : String(error),
        };
      }

      let canvas2d = null;
      try {
        if (typeof OffscreenCanvas !== "undefined") {
          const canvas = new OffscreenCanvas(200, 50);
          const context = canvas.getContext("2d");
          if (context) {
            context.textBaseline = "top";
            context.font = "14px Arial";
            context.fillStyle = "#f60";
            context.fillRect(125, 1, 62, 20);
            context.fillStyle = "#069";
            context.fillText("Privacy Thing E2E", 2, 15);
            context.fillStyle = "rgba(102, 204, 0, 0.7)";
            context.fillText("fingerprint test", 4, 35);
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;
            canvas2d = {
              imageDataHash: hashBytes(imageData),
              imageDataSample: Array.from(imageData.slice(0, 10 * 10 * 4)),
            };
          }
        }
      } catch (error) {
        canvas2d = {
          error: error instanceof Error ? error.message : String(error),
        };
      }

      self.postMessage({
        serverEpochMs: event.data?.serverEpochMs ?? null,
        dateNowEpochMs: Date.now(),
        language: navigator.language,
        languages: navigator.languages,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hardwareConcurrency: navigator.hardwareConcurrency,
        userAgent: navigator.userAgent,
        appVersion: navigator.appVersion,
        platform: navigator.platform,
        vendor: navigator.vendor,
        userAgentData: navigator.userAgentData
          ? {
              platform: navigator.userAgentData.platform,
              mobile: navigator.userAgentData.mobile,
              brands: navigator.userAgentData.brands,
            }
          : null,
        clientHints,
        canvas2d,
        webGL,
        formattedMonthParts: dateTimeFormat.formatToParts(sampleDate),
      });
    } catch (error) {
      self.postMessage({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  { once: true },
);
