process.env.PT_FIREFOX_RUNTIME_TRANSPORT_SCOPE = "state-ops";

const { registerFxTransport } = await import("./firefox-runtime.shared");

registerFxTransport();
