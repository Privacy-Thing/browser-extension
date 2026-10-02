import { fireAndForget } from "@/shared/async";

export const respondUnexpectedError = (
  sendResponse: (response?: unknown) => void,
  error: unknown,
): void => {
  sendResponse({
    ok: false,
    error: error instanceof Error ? error.message : "Unexpected error",
  });
};

export const fireAndRespond = <T>(
  sendResponse: (response?: unknown) => void,
  promise: Promise<T>,
  onError?: (error: unknown) => void,
): void => {
  fireAndForget(
    promise.then((response) => {
      sendResponse(response);
    }),
    onError ?? ((error) => respondUnexpectedError(sendResponse, error)),
  );
};
