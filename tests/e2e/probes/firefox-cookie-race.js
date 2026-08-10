globalThis.collectFirefoxCookieRaceSnapshot = async () => {
  const race = globalThis.__firefoxCookieRace ?? {};
  const snapshot = {
    initialCookie: typeof race.initialCookie === "string" ? race.initialCookie : null,
    laterCookie: globalThis.document.cookie
  };

  globalThis.document.querySelector("#snapshot").textContent = JSON.stringify(snapshot);
  return snapshot;
};
