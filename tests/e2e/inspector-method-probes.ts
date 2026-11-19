import { SurfaceMethodIdSchema } from "../../packages/xray-protocol/src/surface-methods";
import { FX_TRAP_EXCLUSIONS } from "../../src/background/inspector-support";
import {
  isSurfaceSupported,
  SPOOFING_SURFACE_METHODS,
  SPOOFING_SURFACES,
  type SpoofingBrowserTarget,
  type SpoofingSurfaceMethodId,
} from "../../src/shared/spoofing-surfaces";

/**
 * One page call of an Inspector method. Each part is page JavaScript that sees a
 * per-method state object `s`: `setup` runs before the method is armed, `call`
 * makes exactly one call of the method (its value is awaited), and `cleanup`
 * releases what the call created without calling the method again. `exceptOn`
 * names the targets whose test browser cannot make the call, with a one-line
 * reason each.
 */
type MethodProbe = {
  setup?: string;
  call: string;
  cleanup?: string;
  exceptOn?: Partial<Record<SpoofingBrowserTarget, string>>;
};

const analyser = (method: string, array: string, length: string): MethodProbe => ({
  setup: "s.node = new OfflineAudioContext(1, 128, 44100).createAnalyser()",
  call: `s.node.${method}(new ${array}(s.node.${length}))`,
});
const temporalNow = (method: string): MethodProbe => ({
  call: `Temporal.Now.${method}()`,
});
const webGL = (call: string): MethodProbe => ({
  setup: 's.gl = document.createElement("canvas").getContext("webgl")',
  call,
  exceptOn: {
    firefox: "Headless Firefox in the runtime lane creates no WebGL context.",
  },
});
/** `value` is a page expression; month-day and year-month need the locale's calendar. */
const temporalLocale = (type: string, value: string): MethodProbe => ({
  setup: `s.value = Temporal.${type}.from(${value})`,
  call: "s.value.toLocaleString()",
});

/**
 * Every protocol method ID maps to a page call or an explicit exception. The
 * `Record` makes a new protocol method a type error until it is covered here,
 * and the specs re-check the keys at run time against the protocol schema.
 */
export const INSPECTOR_METHOD_PROBES = {
  "geolocation.getCurrentPosition": {
    // The hook reports when the position is delivered, so wait for the callback.
    call: "new Promise((done) => navigator.geolocation.getCurrentPosition(done, done))",
  },
  "geolocation.watchPosition": {
    call: "s.id = navigator.geolocation.watchPosition(() => {}, () => {})",
    cleanup: "navigator.geolocation.clearWatch(s.id)",
  },
  "geolocation.clearWatch": {
    setup: "s.id = navigator.geolocation.watchPosition(() => {}, () => {})",
    call: "navigator.geolocation.clearWatch(s.id)",
  },
  "geolocation.permissionsQuery": {
    call: 'navigator.permissions.query({ name: "geolocation" })',
  },
  "date.constructor": { call: "new Date()" },
  "date.now": { call: "Date.now()" },
  "date.parse": { call: 'Date.parse("2024-01-15T12:34:00")' },
  "date.getTimezoneOffset": {
    setup: "s.date = new Date(0)",
    call: "s.date.getTimezoneOffset()",
  },
  "date.toString": { setup: "s.date = new Date(0)", call: "s.date.toString()" },
  "date.toLocaleString": {
    setup: "s.date = new Date(0)",
    call: "s.date.toLocaleString()",
  },
  "intl.constructor": { call: "new Intl.DateTimeFormat()" },
  "intl.resolvedOptions": {
    setup: "s.format = new Intl.DateTimeFormat()",
    call: "s.format.resolvedOptions()",
  },
  "intl.DateTimeFormat.format": {
    setup: "s.format = new Intl.DateTimeFormat()",
    call: "s.format.format(0)",
  },
  "intl.DateTimeFormat.formatToParts": {
    setup: "s.format = new Intl.DateTimeFormat()",
    call: "s.format.formatToParts(0)",
  },
  "temporal.Now.instant": temporalNow("instant"),
  "temporal.Now.timeZoneId": temporalNow("timeZoneId"),
  "temporal.Now.plainDateTimeISO": temporalNow("plainDateTimeISO"),
  "temporal.Now.zonedDateTimeISO": temporalNow("zonedDateTimeISO"),
  "temporal.Now.plainDateISO": temporalNow("plainDateISO"),
  "temporal.Now.plainTimeISO": temporalNow("plainTimeISO"),
  "temporal.Duration.toLocaleString": temporalLocale("Duration", '"PT1H"'),
  "temporal.Instant.toLocaleString": temporalLocale(
    "Instant",
    '"2024-01-15T12:34:00Z"',
  ),
  "temporal.PlainDate.toLocaleString": temporalLocale("PlainDate", '"2024-01-15"'),
  "temporal.PlainDateTime.toLocaleString": temporalLocale(
    "PlainDateTime",
    '"2024-01-15T12:34"',
  ),
  "temporal.PlainMonthDay.toLocaleString": temporalLocale(
    "PlainMonthDay",
    '{ monthCode: "M01", day: 15, calendar: "gregory" }',
  ),
  "temporal.PlainTime.toLocaleString": temporalLocale("PlainTime", '"12:34"'),
  "temporal.PlainYearMonth.toLocaleString": temporalLocale(
    "PlainYearMonth",
    '{ year: 2024, month: 1, calendar: "gregory" }',
  ),
  "temporal.ZonedDateTime.toLocaleString": temporalLocale(
    "ZonedDateTime",
    '"2024-01-15T12:34:00+00:00[UTC]"',
  ),
  "canvas.getImageData": {
    // Transparent reads carry no fingerprint and are not reported: draw first.
    setup: [
      's.context = document.createElement("canvas").getContext("2d")',
      "s.context.fillRect(0, 0, 4, 4)",
    ].join(";"),
    call: "s.context.getImageData(0, 0, 4, 4)",
  },
  "canvas.toDataURL": {
    setup: 's.canvas = document.createElement("canvas")',
    call: "s.canvas.toDataURL()",
  },
  "canvas.toBlob": {
    setup: 's.canvas = document.createElement("canvas")',
    call: "new Promise((resolve) => s.canvas.toBlob(resolve))",
  },
  "webGL.readPixels": webGL(
    "s.gl.readPixels(0, 0, 1, 1, s.gl.RGBA, s.gl.UNSIGNED_BYTE, new Uint8Array(4))",
  ),
  "webGL.getExtension": webGL('s.gl.getExtension("WEBGL_debug_renderer_info")'),
  "webGL.getSupportedExtensions": webGL("s.gl.getSupportedExtensions()"),
  // UNMASKED_RENDERER_WEBGL; the spoof hides the extension object that names it.
  "webGL.getParameter": webGL("s.gl.getParameter(0x9246)"),
  "audio.getFloatFrequencyData": analyser(
    "getFloatFrequencyData",
    "Float32Array",
    "frequencyBinCount",
  ),
  "audio.getByteFrequencyData": analyser(
    "getByteFrequencyData",
    "Uint8Array",
    "frequencyBinCount",
  ),
  "audio.getFloatTimeDomainData": analyser(
    "getFloatTimeDomainData",
    "Float32Array",
    "fftSize",
  ),
  "audio.getByteTimeDomainData": analyser(
    "getByteTimeDomainData",
    "Uint8Array",
    "fftSize",
  ),
  "audio.getChannelData": {
    setup: "s.buffer = new AudioBuffer({ length: 128, sampleRate: 44100 })",
    call: "s.buffer.getChannelData(0)",
  },
  "navigator.webdriver": { call: "navigator.webdriver" },
  "navigator.hardwareConcurrency": { call: "navigator.hardwareConcurrency" },
  "navigator.deviceMemory": { call: "navigator.deviceMemory" },
  "navigator.maxTouchPoints": { call: "navigator.maxTouchPoints" },
  "navigator.platform": { call: "navigator.platform" },
  "navigator.userAgent": { call: "navigator.userAgent" },
  "navigator.vendor": { call: "navigator.vendor" },
  "navigator.appVersion": { call: "navigator.appVersion" },
  "screen.width": { call: "screen.width" },
  "screen.height": { call: "screen.height" },
  "screen.availWidth": { call: "screen.availWidth" },
  "screen.availHeight": { call: "screen.availHeight" },
  "screen.colorDepth": { call: "screen.colorDepth" },
  "screen.pixelDepth": { call: "screen.pixelDepth" },
  "screen.devicePixelRatio": { call: "window.devicePixelRatio" },
  "clientHints.brands": { call: "navigator.userAgentData.brands" },
  "clientHints.mobile": { call: "navigator.userAgentData.mobile" },
  "clientHints.platform": { call: "navigator.userAgentData.platform" },
  "clientHints.toJSON": { call: "navigator.userAgentData.toJSON()" },
  "clientHints.getHighEntropyValues": {
    call: 'navigator.userAgentData.getHighEntropyValues(["platformVersion"])',
  },
  "battery.getBattery": { call: "navigator.getBattery()" },
  "battery.manager.charging": {
    setup: "s.battery = await navigator.getBattery()",
    call: "s.battery.charging",
  },
  "battery.manager.chargingTime": {
    setup: "s.battery = await navigator.getBattery()",
    call: "s.battery.chargingTime",
  },
  "battery.manager.dischargingTime": {
    setup: "s.battery = await navigator.getBattery()",
    call: "s.battery.dischargingTime",
  },
  "battery.manager.level": {
    setup: "s.battery = await navigator.getBattery()",
    call: "s.battery.level",
  },
  "webRTC.constructor": {
    call: "s.peer = new RTCPeerConnection()",
    cleanup: "s.peer.close()",
  },
  "webRTC.createOffer": {
    setup: "s.peer = new RTCPeerConnection()",
    call: "s.peer.createOffer()",
    cleanup: "s.peer.close()",
  },
  "webRTC.createAnswer": {
    // The hook reports a produced answer, which needs a remote offer.
    setup: [
      "s.peer = new RTCPeerConnection()",
      "const offerer = new RTCPeerConnection()",
      'offerer.createDataChannel("probe")',
      "await s.peer.setRemoteDescription(await offerer.createOffer())",
      "offerer.close()",
    ].join(";"),
    call: "s.peer.createAnswer()",
    cleanup: "s.peer.close()",
  },
  "worker.constructor": {
    call: "s.worker = construct(Worker, urls.worker)",
    cleanup: "s.worker?.terminate()",
  },
  "serviceWorker.register": {
    // The rule blocks registration, so the promise rejects after the read.
    call: "navigator.serviceWorker.register(urls.serviceWorker).catch(() => undefined)",
  },
  "sharedWorker.constructor": {
    call: "construct(SharedWorker, urls.sharedWorker)",
  },
} as const satisfies Record<SpoofingSurfaceMethodId, MethodProbe>;

const PROBES: Readonly<Partial<Record<string, MethodProbe>>> = INSPECTOR_METHOD_PROBES;

/**
 * Catalog methods the Inspector does not offer in the E2E browser although the
 * target supports them: without a payload no hook installs, so nothing can stop.
 * The specs fail when this list and the offered methods disagree.
 */
export const NOT_OFFERED_IN_TEST: Record<
  SpoofingBrowserTarget,
  Partial<Record<SpoofingSurfaceMethodId, string>>
> = {
  chromium: {
    "navigator.vendor":
      "The background reads the native fingerprint in its service worker, where navigator.vendor does not exist.",
    "navigator.deviceMemory":
      "The headless UA token HeadlessChrome is not parsed as Chromium, so no deviceMemory payload is generated.",
  },
  firefox: {
    "navigator.vendor":
      "Firefox's native navigator.vendor is empty, so the profile carries no vendor to install.",
  },
};

/** What one armed page call produced: a stop count, or one stop without the page caller. */
export type StopOutcome = number | "no-page-caller";
/** How the selection reached the document: a live command, or a reload. */
export type Arming = "live" | "next-load";
type KnownDefect = {
  arming: readonly Arming[];
  outcomes: readonly StopOutcome[];
  reason: string;
};

const temporalIds = SPOOFING_SURFACE_METHODS.map((method) => method.id).filter((id) =>
  id.startsWith("temporal."),
);
const defects = (
  ids: readonly SpoofingSurfaceMethodId[],
  defect: KnownDefect,
): Partial<Record<SpoofingSurfaceMethodId, KnownDefect>> =>
  Object.fromEntries(ids.map((id) => [id, defect]));

/**
 * Hooks that do not reliably give one stop called from the page. Each entry is
 * a known defect with the outcomes it produces until it is fixed; remove the
 * entry with the fix so the spec asserts one stop again.
 */
export const KNOWN_STOP_DEFECTS: Record<
  SpoofingBrowserTarget,
  Partial<Record<SpoofingSurfaceMethodId, KnownDefect>>
> = {
  chromium: {
    ...defects(temporalIds, {
      arming: ["live", "next-load"],
      // The early layer keeps its own selection, so its extra stop varies by load.
      outcomes: [1, 2],
      reason:
        "The full runtime wraps the early-inline Temporal wrapper again instead of adopting it, so both report; fixed by PR #119.",
    }),
    // With every method armed, internal calls through other hooks stop as well.
    "geolocation.getCurrentPosition": {
      arming: ["next-load"],
      outcomes: [2],
      reason: "The runtime's position code calls the hooked Date.now, which stops too.",
    },
    "geolocation.watchPosition": {
      arming: ["next-load"],
      outcomes: [2],
      reason: "The runtime's position code calls the hooked Date.now, which stops too.",
    },
    "date.toLocaleString": {
      arming: ["next-load"],
      outcomes: [2],
      reason:
        "The runtime's toLocaleString builds its formatter through the hooked Intl, which stops too.",
    },
  },
  firefox: {
    ...defects(
      [
        "navigator.webdriver",
        "navigator.hardwareConcurrency",
        "navigator.maxTouchPoints",
        "navigator.platform",
        "navigator.userAgent",
        "navigator.appVersion",
        "serviceWorker.register",
      ],
      {
        arming: ["live"],
        outcomes: [0],
        reason:
          "Live commands do not reach the early bundle that owns these hooks; its selection changes only on the next load.",
      },
    ),
    ...defects(
      [
        "geolocation.getCurrentPosition",
        "geolocation.watchPosition",
        "geolocation.clearWatch",
      ],
      {
        arming: ["live", "next-load"],
        outcomes: [0],
        reason:
          'The Firefox geolocation bridge logs only "cache [hit]"/"cache [refresh]", which map to no method ID.',
      },
    ),
    ...defects(
      [...temporalIds, "sharedWorker.constructor", "geolocation.permissionsQuery"],
      {
        arming: ["next-load"],
        outcomes: [2],
        reason:
          "The early bundle also runs as an anonymous copy whose unguarded installers wrap these methods a second time.",
      },
    ),
  },
};

const knownDefect = (target: SpoofingBrowserTarget, arming: Arming, id: string) => {
  const known: Partial<Record<string, KnownDefect>> = KNOWN_STOP_DEFECTS[target];
  const defect = known[id];
  return defect?.arming.includes(arming) ? defect : undefined;
};

/** Replaces outcomes a known defect allows with "known", leaving every other result. */
export const withKnownDefects = (
  target: SpoofingBrowserTarget,
  arming: Arming,
  outcomes: Record<string, StopOutcome>,
): Record<string, StopOutcome | "known"> =>
  Object.fromEntries(
    Object.entries(outcomes).map(([id, outcome]) => [
      id,
      knownDefect(target, arming, id)?.outcomes.includes(outcome) ? "known" : outcome,
    ]),
  );

/** The result every method must give: one stop called from the page, or a known defect. */
export const expectedOutcomes = (
  target: SpoofingBrowserTarget,
  arming: Arming,
  ids: readonly string[],
): Record<string, 1 | "known"> =>
  Object.fromEntries(
    ids.map((id) => [id, knownDefect(target, arming, id) ? "known" : 1]),
  );

export const PROBE_SCRIPT_PATH = "/inspector-coverage-probes.js";

/** Same-origin script URLs the worker probes construct; the server must serve them. */
export type ProbeWorkerUrls = {
  worker: string;
  sharedWorker: string;
  serviceWorker: string;
};

/** Protocol method IDs: the schema the Inspector validates selections against. */
export const protocolMethodIds = (): readonly string[] => SurfaceMethodIdSchema.options;

/** Method IDs the catalog declares, in catalog order. */
export const catalogMethodIds = (): readonly string[] =>
  SPOOFING_SURFACE_METHODS.map((method) => method.id);

/**
 * Methods the Inspector must offer on `target` when every surface is enabled:
 * supported surfaces minus the methods the background excludes by target.
 */
export const expectedArmableIds = (target: SpoofingBrowserTarget): string[] =>
  SPOOFING_SURFACES.flatMap((surface) =>
    isSurfaceSupported(surface, target)
      ? surface.methods.map((method) => method.id)
      : [],
  ).filter((id) => target !== "firefox" || !Object.hasOwn(FX_TRAP_EXCLUSIONS, id));

export const probeTableIds = (): string[] => Object.keys(PROBES);

/**
 * Splits the methods the Inspector offers on `target` into covered and excepted
 * ones. `uncovered` (offered, neither probed nor excepted), `unexpected`
 * (offered outside the catalog) and a `notOffered` that differs from
 * `NOT_OFFERED_IN_TEST` each mean the table must be updated.
 */
export const classifyArmable = (
  target: SpoofingBrowserTarget,
  armable: readonly string[],
) => {
  const expected = expectedArmableIds(target);
  const excepted: Record<string, string> = {};
  for (const id of armable) {
    const reason = PROBES[id]?.exceptOn?.[target];
    if (reason) excepted[id] = reason;
  }
  return {
    covered: armable.filter((id) => PROBES[id] && !excepted[id]),
    excepted,
    uncovered: armable.filter((id) => PROBES[id] === undefined),
    unexpected: armable.filter((id) => !expected.includes(id)),
    notOffered: expected.filter((id) => !armable.includes(id)).sort(),
    notOfferedReasons: NOT_OFFERED_IN_TEST[target],
  };
};

/**
 * Page script that defines one async function per probe step. The functions are
 * written into this script, so a stop's calling frame belongs to its URL.
 */
export const probeScript = (urls: ProbeWorkerUrls): string => {
  const steps = Object.entries(PROBES).flatMap(([id, entry]) => {
    if (!entry) return [];
    const key = JSON.stringify(id);
    return [
      `${key}: {`,
      `  setup: async function probeSetup(s) { ${entry.setup ?? ""}; },`,
      `  call: async function probeCall(s) { return await (${entry.call}); },`,
      `  cleanup: async function probeCleanup(s) { ${entry.cleanup ?? ""}; },`,
      "},",
    ];
  });
  return [
    "(() => {",
    `const urls = ${JSON.stringify(urls)};`,
    // Strict mode may refuse a worker it cannot confirm; the hook has reported by then.
    "const construct = (Type, url) => { try { return new Type(url); } catch { return undefined; } };",
    "const steps = {",
    ...steps,
    "};",
    "const states = {};",
    "const run = async (step, id) => {",
    "  states[id] ??= {};",
    "  await steps[id][step](states[id]);",
    "};",
    "window.inspectorCoverage = {",
    '  setup: (id) => run("setup", id),',
    // The awaited value is dropped so no spoofed object is serialized back.
    '  call: (id) => run("call", id),',
    '  cleanup: (id) => run("cleanup", id),',
    "};",
    "})();",
  ].join("\n");
};
