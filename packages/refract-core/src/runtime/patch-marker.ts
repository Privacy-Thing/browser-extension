import {
  createPrivateMap,
  createPrivateWeakMap,
  privateMapGet,
  privateMapSet,
  privateOwnDescriptor,
  privateSymbolFor,
  privateWeakMapGet,
  privateWeakMapSet,
} from "./primordials";

export type PatchAnchor = {
  fn: Function;
  name: string;
};

export type PatchAnchorState = "absent" | "installed" | "conflict";

const anchorsByFunction = createPrivateWeakMap<Function, Map<string, string>>();

export const inspectPatchAnchors = (
  markerKey: string,
  anchors: readonly PatchAnchor[],
): PatchAnchorState => {
  if (anchors.length === 0) {
    return "absent";
  }
  let installed = 0;
  const publicMarker = privateSymbolFor(markerKey);
  for (const anchor of anchors) {
    const markers = privateWeakMapGet(anchorsByFunction, anchor.fn);
    const installedName = markers ? privateMapGet(markers, markerKey) : undefined;
    if (installedName === undefined) {
      if (privateOwnDescriptor(anchor.fn, publicMarker)) {
        return "conflict";
      }
      continue;
    }
    if (installedName !== anchor.name) {
      return "conflict";
    }
    installed += 1;
  }
  if (installed === 0) {
    return "absent";
  }
  return installed === anchors.length ? "installed" : "conflict";
};

export const markPatchAnchor = (
  fn: Function,
  markerKey: string,
  name: string,
): void => {
  let markers = privateWeakMapGet(anchorsByFunction, fn);
  if (!markers) {
    markers = createPrivateMap<string, string>();
    privateWeakMapSet(anchorsByFunction, fn, markers);
  }
  privateMapSet(markers, markerKey, name);
};
