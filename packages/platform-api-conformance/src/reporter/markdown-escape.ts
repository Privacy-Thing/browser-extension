const escapeMarkdownText = (value: string): string =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("&", "&amp;")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("`", "&#96;")
    .replace(/\r\n?|\n/g, " ");

export const escapeMarkdownTableCell = (value: string): string =>
  escapeMarkdownText(value);

export const escapeMarkdownInline = (value: string): string =>
  escapeMarkdownText(value);
