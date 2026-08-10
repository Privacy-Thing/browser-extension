import type { Config } from "./src/types.js";

const DATE_TO_STRING_PATTERN =
  "^[A-Z][a-z]{2} [A-Z][a-z]{2} \\d{2} \\d{4} \\d{2}:\\d{2}:\\d{2} GMT[+-]\\d{4}(?: \\(.+\\))?$";
const TIME_STRING_PATTERN = "^\\d{2}:\\d{2}:\\d{2} GMT[+-]\\d{4}(?: \\(.+\\))?$";
const DATE_ONLY_PATTERN = "^[A-Z][a-z]{2} [A-Z][a-z]{2} \\d{2} \\d{4}$";
const LOCALE_DATETIME_PATTERN =
  "^\\d{1,2}/\\d{1,2}/\\d{4},? \\d{1,2}:\\d{2}:\\d{2}(?:\\s?[AP]M)?$";
const LOCALE_DATE_PATTERN = "^\\d{1,2}/\\d{1,2}/\\d{4}$";
const LOCALE_TIME_PATTERN = "^\\d{1,2}:\\d{2}:\\d{2}(?:\\s?[AP]M)?$";
const HOUR_CYCLE_PATTERN = "^(h11|h12|h23|h24|missing)$";
const CALENDAR_PATTERN = "^[a-z0-9-]+$";
const NUMBERING_SYSTEM_PATTERN = "^[a-z0-9]{3,8}$";
const OK_PATTERN = "^ok$";

const config: Config = {
  apiSurfaces: [
    // Date spoofing (constructor + 15 prototype methods)
    "Date",
    "Date.prototype",

    // Intl.DateTimeFormat (Proxy construct/apply + instance patches: format, formatToParts, etc.)
    "Intl.DateTimeFormat",
    "Intl.DateTimeFormat.prototype",

    // Other Intl constructors (Proxy locale injection + resolvedOptions)
    "Intl.NumberFormat",
    "Intl.NumberFormat.prototype",
    "Intl.Collator",
    "Intl.Collator.prototype",
    "Intl.RelativeTimeFormat",
    "Intl.RelativeTimeFormat.prototype",
    "Intl.ListFormat",
    "Intl.ListFormat.prototype",
    "Intl.DisplayNames",
    "Intl.DisplayNames.prototype",
    "Intl.PluralRules",
    "Intl.PluralRules.prototype",
    "Intl.Segmenter",
    "Intl.Segmenter.prototype",

    // Navigator (language, languages, webdriver, hardwareConcurrency, etc.)
    "Navigator.prototype",

    // Battery Status (Chromium only: native manager getters are value-masked)
    "BatteryManager.prototype",

    // Client Hints (brands, mobile, platform, toJSON, getHighEntropyValues)
    "NavigatorUAData.prototype",

    // Geolocation (getCurrentPosition, watchPosition, clearWatch)
    "Geolocation.prototype",

    // Permissions (query — intercepts geolocation permission checks)
    "Permissions.prototype",

    // Anti-detection (Function.prototype.toString returns native strings)
    "Function.prototype",

    // Canvas fingerprint spoofing (toDataURL, toBlob, getImageData noise)
    "HTMLCanvasElement.prototype",
    "CanvasRenderingContext2D.prototype",

    // OffscreenCanvas fingerprint spoofing (convertToBlob, getImageData noise).
    // Patched on both the main thread and in workers via the shared
    // installOffscreenNoise.
    "OffscreenCanvas.prototype",
    "OffscreenCanvasRenderingContext2D.prototype",

    // WebGL fingerprint spoofing (UNMASKED_RENDERER/VENDOR interception)
    "WebGLRenderingContext.prototype",
    "WebGL2RenderingContext.prototype",

    // Audio fingerprint spoofing (AnalyserNode noise + AudioBuffer channel APIs)
    "AnalyserNode.prototype",
    "AudioBuffer.prototype",

    // Screen fingerprint spoofing (screen dimensions, devicePixelRatio)
    "Screen.prototype",

    // WebRTC IP leak protection (RTCPeerConnection constructor + SDP sanitisation)
    "RTCPeerConnection",
    "RTCPeerConnection.prototype",

    // Dedicated Worker constructor wrapping (Blob bootstrap injection).
    // SharedWorker is intentionally left native for cross-tab compatibility.
    "Worker",
    "Worker.prototype",

    // ServiceWorker registration interception
    "ServiceWorkerContainer.prototype",

    // Iframe cascade (contentWindow getter intercept)
    "HTMLIFrameElement.prototype",

    // DOM insertion hooks for iframe patching (appendChild, insertBefore, replaceChild)
    "Node.prototype",
  ],
  valueProbes: [
    // ---- Battery Status (native Promise/manager identity + masked getters) ----
    {
      expression: `typeof navigator.getBattery === "function" && typeof BatteryManager === "function" ? "applicable" : "unavailable"`,
      api: "BatteryManager.prototype.chromiumApplicability",
      targets: ["chromium"],
      expectedPattern: "^applicable$",
      expectedDescription:
        "Chromium Battery conformance requires Navigator.getBattery and BatteryManager",
    },
    {
      expression: `typeof navigator.getBattery === "undefined" && typeof BatteryManager === "undefined" ? "not-applicable" : "unexpected-availability"`,
      api: "BatteryManager.prototype.firefoxApplicability",
      targets: ["firefox"],
      expectedPattern: "^not-applicable$",
      expectedDescription:
        "Firefox intentionally leaves the Battery Status API unavailable",
    },
    {
      expression: `(() => { if (typeof navigator.getBattery !== "function") return "unavailable"; const first = navigator.getBattery(); const second = navigator.getBattery(); return first.then((manager) => JSON.stringify({ samePromise: first === second, nativeManager: typeof BatteryManager === "function" && manager instanceof BatteryManager && Object.getPrototypeOf(manager) === BatteryManager.prototype, ownKeys: Object.getOwnPropertyNames(manager), charging: manager.charging, chargingTime: manager.chargingTime, dischargingTime: String(manager.dischargingTime), level: manager.level })); })()`,
      api: "BatteryManager.prototype.behavior",
      targets: ["chromium"],
      category: "compatibility",
      expectedPattern:
        '^\\{"samePromise":true,"nativeManager":true,"ownKeys":\\[\\],"charging":true,"chargingTime":0,"dischargingTime":"Infinity","level":1\\}$',
      expectedDescription:
        "Battery spoofing should preserve the native Promise and manager shape while exposing a full battery",
    },
    {
      kind: "function-lies",
      expression: "Navigator.prototype.getBattery",
      receiverExpression: "navigator",
      api: "Navigator.prototype.getBattery(lies)",
      targets: ["chromium"],
    },
    {
      kind: "function-lies",
      expression:
        'Object.getOwnPropertyDescriptor(BatteryManager.prototype, "charging").get',
      api: "BatteryManager.prototype.charging(lies)",
      targets: ["chromium"],
    },
    {
      kind: "function-lies",
      expression:
        'Object.getOwnPropertyDescriptor(BatteryManager.prototype, "chargingTime").get',
      api: "BatteryManager.prototype.chargingTime(lies)",
      targets: ["chromium"],
    },
    {
      kind: "function-lies",
      expression:
        'Object.getOwnPropertyDescriptor(BatteryManager.prototype, "dischargingTime").get',
      api: "BatteryManager.prototype.dischargingTime(lies)",
      targets: ["chromium"],
    },
    {
      kind: "function-lies",
      expression:
        'Object.getOwnPropertyDescriptor(BatteryManager.prototype, "level").get',
      api: "BatteryManager.prototype.level(lies)",
      targets: ["chromium"],
    },

    // ---- Date methods (function data properties — descriptor shape preserved,
    // only return values differ) ----

    // Core timezone indicator.
    {
      expression: "new Date().getTimezoneOffset()",
      api: "Date.prototype.getTimezoneOffset",
    },
    // CreepJS-style local-date parsing path. This catches regressions where
    // getTimezoneOffset() is spoofed but Date.parse()/new Date("M/D/YYYY")
    // still interpret local date strings in the host timezone.
    {
      expression: `(() => { const d = new Date("2026-07-15T12:00:00.000Z"); const date = d.getDate(); const month = d.getMonth(); const year = d.toString().split(" ")[3]; const format = (n) => ("" + n).length === 1 ? "0" + n : "" + n; const dateString = (month + 1) + "/" + format(date) + "/" + year; const dateStringUTC = year + "-" + format(month + 1) + "-" + format(date); const utc = Date.parse(String(new Date(dateString))); const now = +new Date(dateStringUTC); return String(Number(((utc - now) / 60000).toFixed(0))); })()`,
      api: "Date.parse.localDateStringOffset",
    },
    // Formatted strings include spoofed timezone name/abbreviation.
    {
      expression: "new Date(0).toString()",
      api: "Date.prototype.toString",
      category: "compatibility",
      expectedPattern: DATE_TO_STRING_PATTERN,
      expectedDescription:
        "Date.prototype.toString should preserve the native string shape",
    },
    {
      expression: "new Date(0).toTimeString()",
      api: "Date.prototype.toTimeString",
      category: "compatibility",
      expectedPattern: TIME_STRING_PATTERN,
      expectedDescription:
        "Date.prototype.toTimeString should preserve the native string shape",
    },
    {
      expression: "new Date(0).toDateString()",
      api: "Date.prototype.toDateString",
      category: "compatibility",
      expectedPattern: DATE_ONLY_PATTERN,
      expectedDescription:
        "Date.prototype.toDateString should preserve the native string shape",
    },
    // Locale-sensitive methods — reveal both spoofed timezone and locale.
    {
      expression: "new Date(0).toLocaleString('en-US')",
      api: "Date.prototype.toLocaleString",
      category: "compatibility",
      expectedPattern: LOCALE_DATETIME_PATTERN,
      expectedDescription:
        "Date.prototype.toLocaleString should stay parseable as a native-looking en-US datetime",
    },
    {
      kind: "function-lies",
      expression: "Date.prototype.toString",
      receiverExpression: "Date.prototype",
      api: "Date.prototype.toString(lies)",
    },
    {
      kind: "function-lies",
      expression: "Date.prototype.toLocaleString",
      receiverExpression: "Date.prototype",
      callArgsExpression: "['en-US']",
      api: "Date.prototype.toLocaleString(lies)",
    },
    {
      expression: "new Date(0).toLocaleDateString('en-US')",
      api: "Date.prototype.toLocaleDateString",
      category: "compatibility",
      expectedPattern: LOCALE_DATE_PATTERN,
      expectedDescription:
        "Date.prototype.toLocaleDateString should stay native-looking for en-US",
    },
    {
      expression: "new Date(0).toLocaleTimeString('en-US')",
      api: "Date.prototype.toLocaleTimeString",
      category: "compatibility",
      expectedPattern: LOCALE_TIME_PATTERN,
      expectedDescription:
        "Date.prototype.toLocaleTimeString should stay native-looking for en-US",
    },

    // ---- Intl constructors (proxied — resolvedOptions().locale reveals spoofed locale) ----

    // DateTimeFormat: both timeZone and locale are spoofed.
    {
      expression: "new Intl.DateTimeFormat().resolvedOptions().timeZone",
      api: "Intl.DateTimeFormat.resolvedOptions.timeZone",
    },
    {
      expression: "new Intl.DateTimeFormat().resolvedOptions().locale",
      api: "Intl.DateTimeFormat.resolvedOptions.locale",
    },
    {
      expression: `(() => { const dtf = new Intl.DateTimeFormat(); const getter = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format")?.get; const format = getter ? getter.call(dtf) : null; return typeof format === "function" ? format(new Date(0)) : "missing"; })()`,
      api: "Intl.DateTimeFormat.prototype.format(extracted)",
      category: "compatibility",
      expectedPattern: LOCALE_DATE_PATTERN,
      expectedDescription:
        "Extracted Intl.DateTimeFormat formatter should keep a native-looking date shape",
    },
    {
      kind: "function-lies",
      expression: `Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format")?.get`,
      receiverExpression: "Intl.DateTimeFormat.prototype",
      api: "Intl.DateTimeFormat.prototype.format(getter-lies)",
    },
    {
      expression: `(() => { const getter = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format")?.get; let prototypeAccessError = null; try { void Intl.DateTimeFormat.prototype.format; } catch (error) { prototypeAccessError = error instanceof Error ? error.name : String(error); } return { getterName: getter?.name ?? null, prototypeAccessError }; })()`,
      api: "Intl.DateTimeFormat.prototype.format(getter-parity)",
      category: "stealth",
    },
    {
      kind: "function-lies",
      expression: `(() => { const dtf = new Intl.DateTimeFormat(); const getter = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, "format")?.get; return getter ? getter.call(dtf) : null; })()`,
      callArgsExpression: "[new Date(0)]",
      api: "Intl.DateTimeFormat.prototype.format(returned-function-lies)",
      category: "compatibility",
      expectedPattern: LOCALE_DATE_PATTERN,
      expectedPatternPath: "callOutcome",
      expectedDescription:
        "Returned Intl.DateTimeFormat formatter should keep a native-looking date shape",
    },
    {
      kind: "function-lies",
      expression: "Intl.DateTimeFormat.prototype.resolvedOptions",
      receiverExpression: "Intl.DateTimeFormat.prototype",
      api: "Intl.DateTimeFormat.prototype.resolvedOptions(lies)",
    },
    {
      kind: "function-lies",
      expression: "Intl.DateTimeFormat.prototype.formatToParts",
      receiverExpression: "Intl.DateTimeFormat.prototype",
      callArgsExpression: "[new Date(0)]",
      api: "Intl.DateTimeFormat.prototype.formatToParts(lies)",
    },
    {
      kind: "function-lies",
      expression: "Intl.DateTimeFormat.prototype.formatRange",
      receiverExpression: "Intl.DateTimeFormat.prototype",
      callArgsExpression: "[new Date(0), new Date(1)]",
      api: "Intl.DateTimeFormat.prototype.formatRange(lies)",
    },
    {
      expression: `new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle ?? "missing"`,
      api: "Intl.DateTimeFormat.resolvedOptions.hourCycle",
      category: "compatibility",
      expectedPattern: HOUR_CYCLE_PATTERN,
      expectedDescription:
        "Intl.DateTimeFormat hourCycle should stay within native enum values",
    },
    {
      expression: "new Intl.DateTimeFormat().resolvedOptions().calendar",
      api: "Intl.DateTimeFormat.resolvedOptions.calendar",
      category: "compatibility",
      expectedPattern: CALENDAR_PATTERN,
      expectedDescription:
        "Intl.DateTimeFormat calendar should stay within native identifier format",
    },
    {
      expression: "new Intl.DateTimeFormat().resolvedOptions().numberingSystem",
      api: "Intl.DateTimeFormat.resolvedOptions.numberingSystem",
      category: "compatibility",
      expectedPattern: NUMBERING_SYSTEM_PATTERN,
      expectedDescription:
        "Intl.DateTimeFormat numberingSystem should stay within native identifier format",
    },
    {
      expression: `new Date("2026-01-15T12:00:00.000Z").toString()`,
      api: "Date.prototype.toString(winter)",
      category: "compatibility",
      expectedPattern: DATE_TO_STRING_PATTERN,
      expectedDescription:
        "Winter Date.prototype.toString output should preserve native shape",
    },
    {
      expression: `new Date("2026-07-15T12:00:00.000Z").toString()`,
      api: "Date.prototype.toString(summer)",
      category: "compatibility",
      expectedPattern: DATE_TO_STRING_PATTERN,
      expectedDescription:
        "Summer Date.prototype.toString output should preserve native shape",
    },
    {
      expression: `(() => { const value = new Date(0).toString(); return Number.isFinite(Date.parse(value)) ? "ok" : "invalid"; })()`,
      api: "Date.prototype.toString(parseable)",
      category: "compatibility",
      severityOnChange: "WARNING",
      expectedPattern: OK_PATTERN,
      expectedDescription:
        "Date.prototype.toString output should remain parseable by Date.parse",
    },
    {
      expression: `(() => { const types = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).formatToParts(new Date(0)).map((part) => part.type); const required = ["day", "hour", "minute", "month", "second", "timeZoneName", "year"]; const missing = required.filter((type) => !types.includes(type)); return missing.length === 0 ? "ok" : "missing:" + missing.join(","); })()`,
      api: "Intl.DateTimeFormat.prototype.formatToParts(compat-harness)",
      category: "compatibility",
      severityOnChange: "WARNING",
      expectedPattern: OK_PATTERN,
      expectedDescription:
        "formatToParts should keep the expected token classes for a date+time+zone formatter",
    },
    {
      expression: `(() => { if (typeof Intl.DateTimeFormat.prototype.formatRangeToParts !== "function") return "unsupported"; const parts = new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).formatRangeToParts(new Date(0), new Date(86_400_000)); const types = parts.map((part) => part.type); const required = ["day", "literal", "month", "year"]; const missing = required.filter((type) => !types.includes(type)); if (!parts.some((part) => typeof part.source === "string")) missing.push("source"); return missing.length === 0 ? "ok" : "missing:" + missing.join(","); })()`,
      api: "Intl.DateTimeFormat.prototype.formatRangeToParts(compat-harness)",
      category: "compatibility",
      severityOnChange: "WARNING",
      expectedPattern: "^(ok|unsupported)$",
      expectedDescription:
        "formatRangeToParts should keep the expected token classes when the API is available",
    },
    // Remaining Intl constructors — locale injection via Proxy.
    {
      expression: "new Intl.NumberFormat().resolvedOptions().locale",
      api: "Intl.NumberFormat.resolvedOptions.locale",
    },
    {
      expression: "new Intl.Collator().resolvedOptions().locale",
      api: "Intl.Collator.resolvedOptions.locale",
    },
    {
      expression: "new Intl.PluralRules().resolvedOptions().locale",
      api: "Intl.PluralRules.resolvedOptions.locale",
    },
    {
      expression: "new Intl.RelativeTimeFormat().resolvedOptions().locale",
      api: "Intl.RelativeTimeFormat.resolvedOptions.locale",
    },
    {
      expression: "new Intl.ListFormat().resolvedOptions().locale",
      api: "Intl.ListFormat.resolvedOptions.locale",
    },
    {
      expression: "new Intl.Segmenter().resolvedOptions().locale",
      api: "Intl.Segmenter.resolvedOptions.locale",
    },
    {
      expression:
        "new Intl.DisplayNames('en', { type: 'region' }).resolvedOptions().locale",
      api: "Intl.DisplayNames.resolvedOptions.locale",
    },
    {
      expression: `navigator.userAgentData ? navigator.userAgentData.getHighEntropyValues(["architecture", "bitness", "platformVersion", "uaFullVersion", "fullVersionList"]) : "missing"`,
      api: "NavigatorUAData.prototype.getHighEntropyValues",
    },

    // ---- Permissions / Geolocation lie probes ----
    {
      kind: "function-lies",
      expression: "Permissions.prototype.query",
      receiverExpression: "Permissions.prototype",
      callArgsExpression: `[{ name: "geolocation" }]`,
      api: "Permissions.prototype.query(lies)",
    },
    {
      expression: `navigator.permissions.query({ name: "geolocation" }).then((status) => { const prototype = Object.getPrototypeOf(status); const stateGetter = Object.getOwnPropertyDescriptor(prototype, "state")?.get; let getterAcceptsInstance = true; try { stateGetter?.call(status); } catch { getterAcceptsInstance = false; } return { constructor: prototype?.constructor?.name ?? null, ownProperties: Object.getOwnPropertyNames(status), getterAcceptsInstance, stateIsValid: ["denied", "granted", "prompt"].includes(status.state) }; })`,
      api: "PermissionStatus.geolocation(native-slots)",
      category: "stealth",
    },
    {
      expression: `(() => { let reads = 0; const descriptor = { get name() { reads += 1; return reads === 1 ? "geolocation" : "notifications"; } }; return navigator.permissions.query(descriptor).then(() => reads); })()`,
      api: "Permissions.prototype.query(descriptor-name-reads)",
      category: "stealth",
    },
    {
      expression: `navigator.permissions.query({ name: "geolocation" }).then(async (status) => { const prototype = Object.getPrototypeOf(status); const stateGetter = Object.getOwnPropertyDescriptor(prototype, "state")?.get; await Promise.all(Array.from({ length: 100 }, () => navigator.permissions.query({ name: "geolocation" }))); return stateGetter === Object.getOwnPropertyDescriptor(prototype, "state")?.get; })`,
      api: "PermissionStatus.prototype.state(getter-stability)",
      category: "stealth",
    },
    {
      kind: "function-lies",
      expression: "Geolocation.prototype.getCurrentPosition",
      receiverExpression: "Geolocation.prototype",
      callArgsExpression: "[() => {}, undefined, undefined]",
      api: "Geolocation.prototype.getCurrentPosition(lies)",
    },
    {
      kind: "function-lies",
      expression: "Geolocation.prototype.watchPosition",
      receiverExpression: "Geolocation.prototype",
      callArgsExpression: "[() => {}, undefined, undefined]",
      api: "Geolocation.prototype.watchPosition(lies)",
    },
    {
      kind: "function-lies",
      expression: "Geolocation.prototype.clearWatch",
      receiverExpression: "Geolocation.prototype",
      callArgsExpression: "[1]",
      api: "Geolocation.prototype.clearWatch(lies)",
    },

    // ---- Screen spoofing ----
    { expression: "screen.width", api: "Screen.prototype.width" },
    { expression: "screen.height", api: "Screen.prototype.height" },
    { expression: "screen.availWidth", api: "Screen.prototype.availWidth" },
    { expression: "screen.availHeight", api: "Screen.prototype.availHeight" },
    { expression: "screen.colorDepth", api: "Screen.prototype.colorDepth" },
    { expression: "window.devicePixelRatio", api: "window.devicePixelRatio" },

    // ---- Canvas fingerprint spoofing ----
    // Canvas noise is applied via getImageData / toDataURL. Drawing deterministic
    // content and exporting produces different output when noise seed is active.
    {
      expression: `(() => { const c = document.createElement('canvas'); c.width = 16; c.height = 16; const ctx = c.getContext('2d'); if (!ctx) return 'no-context'; ctx.fillStyle = '#ff6600'; ctx.fillRect(0, 0, 16, 16); ctx.fillStyle = '#0066ff'; ctx.font = '14px Arial'; ctx.fillText('GW', 2, 12); return c.toDataURL(); })()`,
      api: "HTMLCanvasElement.prototype.toDataURL",
    },
    {
      expression: `(() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const ctx = c.getContext('2d'); if (!ctx) return 'no-context'; ctx.fillStyle = '#336699'; ctx.fillRect(0, 0, 4, 4); const d = ctx.getImageData(0, 0, 4, 4).data; return Array.from(d.slice(0, 16)).join(','); })()`,
      api: "CanvasRenderingContext2D.prototype.getImageData",
    },

    // ---- WebGL fingerprint spoofing ----
    // In suppression mode getExtension("WEBGL_debug_renderer_info") returns null.
    // In string-spoofing mode getParameter returns spoofed renderer/vendor.
    // readPixels() now perturbs a tiny deterministic subset of the successful
    // readback so rendered-pixel hashes drift without changing descriptor shape.
    {
      expression: `(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); if (!gl) return 'no-webgl'; const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (!ext) return 'ext-suppressed'; return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) + '|' + gl.getParameter(ext.UNMASKED_VENDOR_WEBGL); })()`,
      api: "WebGLRenderingContext.prototype.getParameter",
    },
    {
      expression: `(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); if (!gl) return 'no-webgl'; const exts = gl.getSupportedExtensions() || []; return String(exts.includes('WEBGL_debug_renderer_info')); })()`,
      api: "WebGLRenderingContext.prototype.getSupportedExtensions",
    },
    {
      expression: `(() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const gl = c.getContext('webgl'); if (!gl) return 'no-webgl'; gl.viewport(0, 0, 4, 4); gl.clearColor(0.25, 0.5, 0.75, 1); gl.clear(gl.COLOR_BUFFER_BIT); const pixels = new Uint8Array(4 * 4 * 4); gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels); let hash = 2166136261; for (let i = 0; i < pixels.length; i += 1) { hash = Math.imul(hash ^ pixels[i], 16777619); } return String(hash >>> 0); })()`,
      api: "WebGLRenderingContext.prototype.readPixels",
    },

    // ---- Audio fingerprint spoofing ----
    // AudioBuffer.getChannelData() has bounded noise injected on first call.
    // Fill a buffer with known values via
    // copyToChannel, then read back via getChannelData to detect perturbation.
    {
      expression: `(() => { try { const ctx = new OfflineAudioContext(1, 128, 44100); const buf = ctx.createBuffer(1, 128, 44100); const src = new Float32Array(128).fill(0.5); buf.copyToChannel(src, 0); const data = buf.getChannelData(0); return Array.from(data.slice(0, 20)).map(v => v.toFixed(6)).join(','); } catch(e) { return 'error:' + e.message; } })()`,
      api: "AudioBuffer.prototype.getChannelData",
    },
    {
      expression: `(() => { try { const ctx = new OfflineAudioContext(1, 128, 44100); const buf = ctx.createBuffer(1, 128, 44100); const src = new Float32Array(128).fill(0.5); buf.copyToChannel(src, 0); const out = new Float32Array(20); buf.copyFromChannel(out, 0); return Array.from(out).map(v => v.toFixed(6)).join(','); } catch(e) { return 'error:' + e.message; } })()`,
      api: "AudioBuffer.prototype.copyFromChannel",
    },
    {
      expression: `(() => { try { const ctx = new OfflineAudioContext(1, 128, 44100); const buf = ctx.createBuffer(1, 128, 44100); buf.getChannelData(0); const src = new Float32Array(16).fill(0.25); buf.copyToChannel(src, 0, 8); return Array.from(buf.getChannelData(0).slice(8, 24)).map(v => v.toFixed(6)).join(','); } catch(e) { return 'error:' + e.message; } })()`,
      api: "AudioBuffer.prototype.copyToChannel",
    },
    // AnalyserNode.getByteFrequencyData — without audio input returns all zeros,
    // and every native-written sample flips to 1 when spoofed.
    {
      expression: `(() => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const analyser = ctx.createAnalyser(); analyser.fftSize = 64; const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data); ctx.close(); return Array.from(data.slice(0, 10)).join(','); } catch(e) { return 'error:' + e.message; } })()`,
      api: "AnalyserNode.prototype.getByteFrequencyData",
    },

    // ---- WebRTC IP leak protection ----
    // The RTCPeerConnection constructor forces iceTransportPolicy to "relay",
    // preventing host/srflx candidate gathering that leaks local IPs.
    {
      expression: `(() => { if (typeof RTCPeerConnection === 'undefined') return 'unavailable'; try { const pc = new RTCPeerConnection({ iceTransportPolicy: 'all' }); const policy = pc.getConfiguration().iceTransportPolicy; pc.close(); return policy; } catch(e) { return 'error:' + e.message; } })()`,
      api: "RTCPeerConnection.iceTransportPolicy",
    },
    {
      expression: `(() => { if (typeof RTCPeerConnection === "undefined") return "unavailable"; const pc = new RTCPeerConnection(); return new Promise((resolve) => { const returned = pc.createOffer((description) => { pc.close(); resolve({ callback: "success", hasDescription: Boolean(description), returnsPromise: returned instanceof Promise }); }, (error) => { pc.close(); resolve({ callback: "failure", error: error?.name ?? String(error), returnsPromise: returned instanceof Promise }); }); }); })()`,
      api: "RTCPeerConnection.createOffer(legacy-callback)",
      category: "compatibility",
    },

    // ---- Wrapped constructor semantics ----
    {
      expression: `(() => { let noNew; try { Blob([]); noNew = "allowed"; } catch (error) { noNew = error instanceof Error ? error.name : String(error); } class DerivedBlob extends Blob {} const instance = new DerivedBlob(["worker source"], { type: "text/javascript" }); return { noNew, preservesSubclass: instance instanceof DerivedBlob }; })()`,
      api: "Blob.constructor-semantics",
      category: "compatibility",
    },
    {
      expression: `(() => { if (typeof Worker === "undefined") return "unavailable"; let noNew; try { Worker("data:text/javascript,"); noNew = "allowed"; } catch (error) { noNew = error instanceof Error ? error.name : String(error); } const blobUrl = URL.createObjectURL(new Blob(["self.close()"], { type: "text/javascript" })); try { class DerivedWorker extends Worker {} const instance = new DerivedWorker(blobUrl); const preservesSubclass = instance instanceof DerivedWorker; instance.terminate(); return { noNew, preservesSubclass }; } finally { URL.revokeObjectURL(blobUrl); } })()`,
      api: "Worker.constructor-semantics",
      category: "compatibility",
    },

    // ---- Dedicated Worker runtime parity ----
    {
      expression: "navigator.language",
      api: "Worker.Navigator.prototype.language",
      context: "worker",
    },
    {
      expression: "navigator.languages",
      api: "Worker.Navigator.prototype.languages",
      context: "worker",
    },
    {
      expression: "new Intl.DateTimeFormat().resolvedOptions().locale",
      api: "Worker.Intl.DateTimeFormat.resolvedOptions.locale",
      context: "worker",
    },
    {
      expression: "new Intl.DateTimeFormat().resolvedOptions().timeZone",
      api: "Worker.Intl.DateTimeFormat.resolvedOptions.timeZone",
      context: "worker",
    },
    {
      expression: `(() => { const d = new Date("2026-07-15T12:00:00.000Z"); return String(d.getTimezoneOffset()); })()`,
      api: "Worker.Date.prototype.getTimezoneOffset",
      context: "worker",
    },
    {
      expression: `(() => { const d = new Date("2026-07-15T12:00:00.000Z"); const date = d.getDate(); const month = d.getMonth(); const year = d.toString().split(" ")[3]; const format = (n) => ("" + n).length === 1 ? "0" + n : "" + n; const dateString = (month + 1) + "/" + format(date) + "/" + year; const dateStringUTC = year + "-" + format(month + 1) + "-" + format(date); const utc = Date.parse(String(new Date(dateString))); const now = +new Date(dateStringUTC); return String(Number(((utc - now) / 60000).toFixed(0))); })()`,
      api: "Worker.Date.parse.localDateStringOffset",
      context: "worker",
    },
    {
      expression: `(() => navigator.userAgentData ? ({ platform: navigator.userAgentData.platform, mobile: navigator.userAgentData.mobile, brands: navigator.userAgentData.brands }) : "missing")()`,
      api: "Worker.Navigator.prototype.userAgentData",
      context: "worker",
    },
    {
      expression: `navigator.userAgentData ? navigator.userAgentData.getHighEntropyValues(["architecture", "bitness", "platformVersion", "uaFullVersion", "fullVersionList"]) : "missing"`,
      api: "Worker.NavigatorUAData.prototype.getHighEntropyValues",
      context: "worker",
    },
    {
      expression: `(() => { if (typeof OffscreenCanvas === "undefined") return "no-offscreen-canvas"; const c = new OffscreenCanvas(1, 1); const gl = c.getContext("webgl"); if (!gl) return "no-webgl"; const ext = gl.getExtension("WEBGL_debug_renderer_info"); if (!ext) return "ext-suppressed"; return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) + "|" + gl.getParameter(ext.UNMASKED_VENDOR_WEBGL); })()`,
      api: "Worker.WebGLRenderingContext.prototype.getParameter",
      context: "worker",
    },
    {
      expression: `(() => { if (typeof OffscreenCanvas === "undefined") return "no-offscreen-canvas"; const c = new OffscreenCanvas(1, 1); const gl = c.getContext("webgl"); if (!gl) return "no-webgl"; const exts = gl.getSupportedExtensions() || []; return String(exts.includes("WEBGL_debug_renderer_info")); })()`,
      api: "Worker.WebGLRenderingContext.prototype.getSupportedExtensions",
      context: "worker",
    },
    {
      expression: `(() => { if (typeof OffscreenCanvas === "undefined") return "no-offscreen-canvas"; const c = new OffscreenCanvas(4, 4); const gl = c.getContext("webgl"); if (!gl) return "no-webgl"; gl.viewport(0, 0, 4, 4); gl.clearColor(0.25, 0.5, 0.75, 1); gl.clear(gl.COLOR_BUFFER_BIT); const pixels = new Uint8Array(4 * 4 * 4); gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels); let hash = 2166136261; for (let i = 0; i < pixels.length; i += 1) { hash = Math.imul(hash ^ pixels[i], 16777619); } return String(hash >>> 0); })()`,
      api: "Worker.WebGLRenderingContext.prototype.readPixels",
      context: "worker",
    },
  ],
  suppressions: [
    {
      api: /^BatteryManager\./,
      targets: ["firefox"],
      reason:
        "Battery Status is Chromium-only and guarded by feature detection; Firefox remains intentionally not applicable.",
    },
    {
      api: "Navigator.prototype.getBattery",
      targets: ["firefox"],
      reason: "Navigator.getBattery is Chromium-only and remains absent on Firefox.",
    },
    // NavigatorUAData (Client Hints) is Chromium-only. Privacy Thing's client-hints-patch.ts
    // guards all patches behind `if ("userAgentData" in navigator)`, so nothing is
    // spoofed on Firefox. BCD correctly reports these as "never added" in Firefox,
    // but the CRITICAL finding is a false alarm — the code never executes there.
    {
      api: /^NavigatorUAData\./,
      reason:
        "Client Hints are Chromium-only; Privacy Thing guards patches behind feature detection — no spoofing on Firefox.",
    },
    {
      api: "Navigator.prototype.userAgentData",
      reason:
        "userAgentData is a Client Hints surface (Chromium-only); getter is guarded by feature detection.",
    },
  ],
  defaultTargetPreset: "pt-supported",
  targetPresets: {
    "pt-supported": [
      { name: "chrome", version: 147 },
      { name: "firefox", version: 149 },
    ],
    "latest-stable": [
      { name: "chrome", version: 147 },
      { name: "firefox", version: 149 },
      { name: "safari", version: 26 },
      { name: "edge", version: 147 },
    ],
    "mv3-minimum": [
      { name: "chrome", version: 110 },
      { name: "firefox", version: 109 },
    ],
    "wide-range": [
      { name: "chrome", version: 100 },
      { name: "chrome", version: 147 },
      { name: "firefox", version: 100 },
      { name: "firefox", version: 149 },
    ],
  },
  cacheDir: "build/api-conformance/cache",
  outputDir: "build/api-conformance",
};

export default config;
