export const getFxStaticCandidatesKey = (): string => __PT_FX_STATIC_CANDIDATES_KEY__;
export const getFxStateEvent = (): string => __PT_FX_STATE_CHANGE_EVENT__;
export const getFxHandoffReadyEvent = (): string => __PT_FX_HANDOFF_READY_EVENT__;
/* eslint-disable sonarjs/redundant-type-aliases */
export type FirefoxShimState = any;
export type FxStaticStateCandidate = any;
export type FirefoxWindowSeedState = any;
/* eslint-enable sonarjs/redundant-type-aliases */

export const buildFirefoxShimState = (): any => null;
export const injectFxEphemeralState = (): void => {};
export const dispatchFxStateEvent = (): void => {};
export const isFirefoxShimState = (): boolean => false;
export const normalizeFxState = (): any => null;
export const toSnapshotFromFxState = (): any => null;
export const isFirefoxWindowSeedState = (): boolean => false;
export const normalizeFxWindowSeed = (): any => null;
export const resolveFxSeedForHost = (): any => null;
export const takeFxStaticState = (): any => null;
export const clearFirefoxStaticState = (): void => {};
export const parseFirefoxHashSeed = (): any => null;
export const buildFirefoxHashSeed = (): string => "";
export const buildFxSeededUrl = (): string => "";
export const takeFxEphemeralState = (): any => null;
export const parseFxStateEvent = (): any => null;
export const takeFxMainHandoff = (): any => null;
