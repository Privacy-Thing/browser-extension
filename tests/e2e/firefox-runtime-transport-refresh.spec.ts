process.env.PT_FIREFOX_RUNTIME_TRANSPORT_SCOPE = "location-refresh";

const { registerFxTransport } = await import("./firefox-runtime.shared");

registerFxTransport();
