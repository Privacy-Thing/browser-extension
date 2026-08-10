/* global navigator, self */

self.addEventListener("connect", (event) => {
  const port = event.ports[0];

  port.addEventListener(
    "message",
    () => {
      try {
        const sampleDate = new Date(Date.UTC(2020, 0, 15, 12, 0, 0));
        const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
          month: "long",
          timeZoneName: "short",
        });

        port.postMessage({
          language: navigator.language,
          languages: navigator.languages,
          locale: Intl.DateTimeFormat().resolvedOptions().locale,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          hardwareConcurrency: navigator.hardwareConcurrency,
          userAgent: navigator.userAgent,
          appVersion: navigator.appVersion,
          platform: navigator.platform,
          vendor: navigator.vendor,
          formattedMonthParts: dateTimeFormat.formatToParts(sampleDate),
        });
      } catch (error) {
        port.postMessage({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    { once: true },
  );

  port.start();
});
