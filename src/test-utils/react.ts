import { act } from "react";

export const flushReactEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};
