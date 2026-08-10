export const AUTOSAVE_DELAY_MS = 450;

// The background service worker can be momentarily unavailable right after
// install/update. Retry the initial settings load a few times before giving up,
// so the options UI never runs with default (unloaded) state and never persists
// it over the stored configuration.
export const LOAD_MAX_RETRIES = 5;
export const LOAD_RETRY_DELAY_MS = 300;
