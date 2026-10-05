import { expect } from "@playwright/test";

import { openFxOptionsProbe, test } from "./firefox-runtime.shared";

test("Firefox Control D migrates and forgets credentials in private extension storage", async ({
  context,
  extensionOrigin,
  debuggerPort,
}) => {
  const options = await openFxOptionsProbe({ context, extensionOrigin, debuggerPort });
  const migrated = await options.evaluate<{
    response: { ok: boolean; state: { hasApiKey: boolean } };
    legacyPresent: boolean;
    privateKeyPresent: boolean;
  }>(`(async () => {
    const key = "pt.experimental.control-d.v2.api-key";
    await chrome.storage.local.set({ [key]: "test-only-credential" });
    const response = await chrome.runtime.sendMessage({ type: "pt.control-d.get-state" });
    const legacyPresent = (await chrome.storage.local.get(key))[key] !== undefined;
    const privateKeyPresent = await new Promise((resolve, reject) => {
      const request = indexedDB.open("pt.experimental.control-d.credentials", 1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("keys", "readonly");
        const entry = transaction.objectStore("keys").get("api-key");
        transaction.oncomplete = () => {
          database.close();
          resolve(entry.result === "test-only-credential");
        };
        transaction.onabort = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    return { response, legacyPresent, privateKeyPresent };
  })()`);
  expect(migrated.response).toMatchObject({ ok: true, state: { hasApiKey: true } });
  expect(migrated.legacyPresent).toBe(false);
  expect(migrated.privateKeyPresent).toBe(true);
  const disconnected = await options.evaluate(
    `chrome.runtime.sendMessage({ type: "pt.control-d.disconnect" })`,
  );
  expect(disconnected).toMatchObject({ ok: true, state: { hasApiKey: false } });
});
