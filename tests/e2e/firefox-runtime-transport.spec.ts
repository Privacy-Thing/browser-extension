process.env.PT_FIREFOX_RUNTIME_TRANSPORT_SCOPE = "permission-seeds";

const { registerFxTransport } = await import("./firefox-runtime.shared");

registerFxTransport();
