export const fireAndForget = (
  promise: Promise<unknown>,
  onError?: (error: unknown) => void,
): void => {
  promise.catch((error: unknown) => {
    onError?.(error);
  });
};
