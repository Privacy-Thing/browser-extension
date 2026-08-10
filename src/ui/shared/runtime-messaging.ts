export const isExtensionContextValid = (): boolean => {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
};

export const sendRuntimeMessage = async <TResponse>(
  message: unknown,
): Promise<TResponse | null> => {
  if (!isExtensionContextValid()) {
    return null;
  }

  try {
    return (await chrome.runtime.sendMessage(message)) as TResponse;
  } catch {
    return null;
  }
};

export const sendMessageOrThrow = async <TResponse>(
  message: unknown,
): Promise<TResponse> => {
  if (!isExtensionContextValid()) {
    throw new Error("Extension context invalidated.");
  }

  try {
    return (await chrome.runtime.sendMessage(message)) as TResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    const message = typeof error === "string" ? error : "Runtime message failed.";
    throw new Error(message, { cause: error });
  }
};
