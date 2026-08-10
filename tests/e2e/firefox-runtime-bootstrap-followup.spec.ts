process.env.PT_FIREFOX_RUNTIME_BOOTSTRAP_SCOPE = "navigation-signals";

const { registerFxBootstrap } = await import("./firefox-runtime.shared");

registerFxBootstrap();
