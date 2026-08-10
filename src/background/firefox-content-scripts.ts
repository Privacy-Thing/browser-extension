export const getRegisteredFxScriptIds = (
  registrations: readonly Pick<chrome.scripting.RegisteredContentScript, "id">[],
): string[] => registrations.map(({ id }) => id);
