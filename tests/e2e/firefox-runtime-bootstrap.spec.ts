process.env.PT_FIREFOX_RUNTIME_BOOTSTRAP_SCOPE = "preload-reload";

const { registerFxBootstrap } = await import("./firefox-runtime.shared");

registerFxBootstrap();
