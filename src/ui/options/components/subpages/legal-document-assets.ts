const licenseTextModules = import.meta.glob("../../../../../licenses/**/*.txt", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

export const bundledLicenseTexts = new Map(
  Object.entries(licenseTextModules).reduce<Array<readonly [string, string]>>(
    (entries, [modulePath, content]) => {
      const relativePath = modulePath.split("licenses/")[1]?.trim();

      if (!relativePath) {
        return entries;
      }

      entries.push([`licenses/${relativePath}`, content]);
      return entries;
    },
    [],
  ),
);
