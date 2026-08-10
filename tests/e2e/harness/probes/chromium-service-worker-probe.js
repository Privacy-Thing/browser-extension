/* global navigator, self */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const replyPort = event.ports[0];
  if (!replyPort) {
    return;
  }

  try {
    const sampleDate = new Date(Date.UTC(2020, 0, 15, 12, 0, 0));
    const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
      month: "long",
      timeZoneName: "short",
    });

    replyPort.postMessage({
      scope: self.registration.scope,
      language: navigator.language,
      languages: navigator.languages,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      formattedMonthParts: dateTimeFormat.formatToParts(sampleDate),
    });
  } catch (error) {
    replyPort.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
