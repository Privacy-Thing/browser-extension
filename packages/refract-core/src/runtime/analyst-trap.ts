// Keep this source outside the debugger ignore list: ignored debugger statements
// are skipped by Chromium. It must not call page hooks or collect a stack.
export const pause = (): void => {
  // eslint-disable-next-line no-debugger
  debugger;
};
