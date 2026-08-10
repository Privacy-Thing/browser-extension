/* global BroadcastChannel, navigator, self */

const sampleDate = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "collect" || typeof event.data.channel !== "string") {
    return;
  }

  const channel = new BroadcastChannel(event.data.channel);
  channel.postMessage({
    language: navigator.language,
    languages: Array.from(navigator.languages ?? []),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: sampleDate.getTimezoneOffset(),
  });
  channel.close();
});
