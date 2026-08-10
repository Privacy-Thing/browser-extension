/* global document, navigator, setTimeout */

globalThis.collectFirefoxTimeLocaleRaceSnapshot = async () => {
  const race = globalThis.__firefoxTimeLocaleRace ?? {};
  const raceEvents = globalThis.__firefoxTimeLocaleRaceEvents ?? {};
  const probeDate = new Date("2026-03-29T12:00:00.000Z");

  // Poll deterministically until the shim changes navigator.language
  // away from the initial (unspoofed) value, or until deadline.
  const initialLang = race.initialLanguage ?? navigator.language;
  const deadline = Date.now() + 15_000;
  await new Promise((resolve) => {
    const tick = () => {
      if (navigator.language !== initialLang || Date.now() >= deadline) {
        resolve(undefined);
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });

  const snapshot = {
    initialLanguage: race.initialLanguage ?? null,
    initialLanguages: Array.isArray(race.initialLanguages) ? race.initialLanguages : null,
    initialTimeZone: race.initialTimeZone ?? null,
    initialTimezoneOffset:
      typeof race.initialTimezoneOffset === "number" ? race.initialTimezoneOffset : null,
    laterHash: globalThis.location.hash,
    laterLanguage: navigator.language,
    laterLanguages: [...navigator.languages],
    laterTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    laterTimezoneOffset: new Date("2026-03-29T12:00:00.000Z").getTimezoneOffset(),
    staleFormatterTimeZone:
      race.earlyFormatter?.resolvedOptions?.().timeZone ?? null,
    staleFormatterValue:
      typeof race.earlyFormatter?.format === "function"
        ? race.earlyFormatter.format(probeDate)
        : null,
    hashchangeCount:
      typeof raceEvents.hashchange === "number" ? raceEvents.hashchange : null,
    historyLength: globalThis.history.length,
    scrollY: globalThis.scrollY,
    anchorTop:
      document.querySelector("#hash-target")?.getBoundingClientRect()?.top ?? null,
    anchorInViewport: Boolean(
      document.querySelector("#hash-target") &&
        document.querySelector("#hash-target").getBoundingClientRect().top < globalThis.innerHeight
    ),
    freshFormatterValue: new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long"
    }).format(probeDate)
  };

  document.querySelector("#snapshot").textContent = JSON.stringify(snapshot);
  return snapshot;
};
