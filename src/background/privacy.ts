const WEBRTC_POLICY = "default_public_interface_only";

export const getWebRtcPrivacyPolicy = (): string => WEBRTC_POLICY;

// `null` means "not yet confirmed" (readback never ran, or itself failed) —
// distinct from `false` ("confirmed the browser did not apply the requested
// policy"). Only `false` should downgrade the webRTC surface; missing
// evidence must not be treated as a failure (#111).
let webRtcPolicyConfirmed: boolean | null = null;

export const getWebRtcPolicyConfirmed = (): boolean | null => webRtcPolicyConfirmed;

export const applyPrivacyDefaults = async (): Promise<void> => {
  await chrome.privacy.network.webRTCIPHandlingPolicy.set({
    value: WEBRTC_POLICY,
  });

  try {
    const details = await chrome.privacy.network.webRTCIPHandlingPolicy.get({});
    webRtcPolicyConfirmed = details.value === WEBRTC_POLICY;
  } catch {
    webRtcPolicyConfirmed = null;
  }
};
