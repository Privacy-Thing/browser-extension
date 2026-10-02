/** Local Blob download; never uploads data or requests extension permissions. */
export const downloadLocalText = (
  filename: string,
  content: string,
  mimeType: string,
): void => {
  const url = URL.createObjectURL(
    new Blob([content], { type: `${mimeType};charset=utf-8` }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    queueMicrotask(() => URL.revokeObjectURL(url));
  }
};
