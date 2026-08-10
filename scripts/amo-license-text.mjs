export const toAmoPlainTextLicense = (text) =>
  text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/_\*\*([\s\S]*?)\*\*_/g, "$1")
    .replace(/\*\*\*([\s\S]*?)\*\*\*/g, "$1")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1");
