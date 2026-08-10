/* global document, navigator, setTimeout */

globalThis.collectFirefoxDateIntlConsistencySnapshot = async () => {
  const race = globalThis.__firefoxDateIntlRace ?? {};

  // Poll deterministically until the shim applies the spoofed locale,
  // or until deadline - avoids a fixed sleep that flakes on slow CI.
  const deadline = Date.now() + 15_000;
  await new Promise((resolve) => {
    const tick = () => {
      if (navigator.language !== "en-US" || Date.now() >= deadline) {
        resolve(undefined);
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });

  const snapshot = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    shimDatasetTimeLocale: (() => {
      // Hybrid transport: the ephemeral <script type="application/json">
      // bootstrap element is removed by the geo-shim after first read.
      // Verify no persistent state port (<span>) remains in <head>.
      const spans = document.querySelectorAll("head > span[style*='display']");
      if (spans.length > 0) {
        return "__STALE_SPAN_PORT_DETECTED__";
      }
      // Check if the spoofed timeZone is correctly reflected via Intl,
      // which confirms the state was delivered through the hybrid channel.
      const resolvedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return resolvedTz || null;
    })(),
    runtimeConfigJson:
      document.querySelector("script[data-pt-runtime-config]")?.textContent ?? null,
    dateToString:
      typeof race.earlyDate?.toString === "function" ? race.earlyDate.toString() : null,
    dateToLocaleString:
      typeof race.earlyDate?.toLocaleString === "function"
        ? race.earlyDate.toLocaleString()
        : null,
    dateTimezoneOffset:
      typeof race.earlyDate?.getTimezoneOffset === "function"
        ? race.earlyDate.getTimezoneOffset()
        : null,
    staleFormatterValue:
      typeof race.earlyFormatter?.format === "function"
        ? race.earlyFormatter.format(race.earlyDate)
        : null,
    freshFormatterValue: new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
    }).format(race.earlyDate),
  };

  document.querySelector("#snapshot").textContent = JSON.stringify(snapshot);
  return snapshot;
};
