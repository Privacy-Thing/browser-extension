import {
  createPrivateWeakMap,
  privateWeakMapGet,
  privateWeakMapSet,
} from "../runtime/primordials";

export type CanvasContentState = "blank" | "dirty" | "unknown";

const BLANK_STATE = "canvas-content:blank";
const DIRTY_STATE = "canvas-content:dirty";
const canvasContentStates = createPrivateWeakMap<
  object,
  typeof BLANK_STATE | typeof DIRTY_STATE
>();

export const getCanvasContentState = (canvas: object): CanvasContentState => {
  const state = privateWeakMapGet(canvasContentStates, canvas);
  if (state === BLANK_STATE) return "blank";
  if (state === DIRTY_STATE) return "dirty";
  return "unknown";
};

/** Unknown untouched canvases remain native; dirty state is shared across same-origin realms. */
export const isCanvasKnownBlank = (canvas: object): boolean =>
  getCanvasContentState(canvas) !== "dirty";

export const markCanvasContentDirty = (canvas: object): void => {
  privateWeakMapSet(canvasContentStates, canvas, DIRTY_STATE);
};

export const markCanvasContentBlank = (canvas: object): void => {
  privateWeakMapSet(canvasContentStates, canvas, BLANK_STATE);
};

export const markCanvasBlank = (canvas: object): void => {
  if (getCanvasContentState(canvas) === "unknown") {
    markCanvasContentBlank(canvas);
  }
};

const isPrimitiveZero = (value: unknown): boolean =>
  (typeof value === "number" && value === 0) ||
  (typeof value === "string" && value.trim() !== "" && Number(value) === 0);

const ALPHA_DRAW_OPS = new Set([
  "drawImage",
  "fill",
  "fillRect",
  "fillText",
  "stroke",
  "strokeRect",
  "strokeText",
]);

export type CanvasMutationNoOpState = {
  currentPathEmpty?: boolean;
  globalAlpha?: number | undefined;
};

const hasCertainZeroArea = (operation: string, args: readonly unknown[]): boolean => {
  if (operation === "fillRect" || operation === "clearRect") {
    return isPrimitiveZero(args[2]) || isPrimitiveZero(args[3]);
  }
  if (operation !== "drawImage") {
    return false;
  }
  if (args.length >= 9) {
    return isPrimitiveZero(args[7]) || isPrimitiveZero(args[8]);
  }
  return args.length >= 5 && (isPrimitiveZero(args[3]) || isPrimitiveZero(args[4]));
};

const drawsEmptyCurrentPath = (
  operation: string,
  args: readonly unknown[],
  currentPathEmpty: boolean | undefined,
): boolean =>
  currentPathEmpty === true &&
  ((operation === "fill" && (args.length === 0 || typeof args[0] === "string")) ||
    (operation === "stroke" && args.length === 0));

export const isCanvasMutationNoOp = (
  operation: string,
  args: readonly unknown[],
  state: CanvasMutationNoOpState = {},
): boolean =>
  hasCertainZeroArea(operation, args) ||
  ((operation === "fillText" || operation === "strokeText") && args[0] === "") ||
  drawsEmptyCurrentPath(operation, args, state.currentPathEmpty) ||
  (state.globalAlpha === 0 && ALPHA_DRAW_OPS.has(operation));
