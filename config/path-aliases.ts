import { fileURLToPath, URL } from "node:url";

export const configDirectory = fileURLToPath(new URL(".", import.meta.url));
export const repositoryRootDirectory = fileURLToPath(new URL("..", import.meta.url));
const srcDirectory = fileURLToPath(new URL("../src", import.meta.url));
const packagesUiDirectory = fileURLToPath(
  new URL("../packages/ui/src", import.meta.url),
);

export const uiAliasEntries = [
  {
    find: "@/ui/components/ui/toast",
    replacement: `${packagesUiDirectory}/ui/toast.tsx`,
  },
  {
    find: /^@\/ui\/components\/ui\/(.*)$/,
    replacement: `${packagesUiDirectory}/ui/$1`,
  },
  {
    find: "@/ui/components/lib/utils",
    replacement: `${packagesUiDirectory}/lib/utils.ts`,
  },
  {
    find: "@/ui/components/settings-control-metadata",
    replacement: `${packagesUiDirectory}/settings-control-metadata.tsx`,
  },
  {
    find: "@/ui/components/focus-first-setting-control",
    replacement: `${packagesUiDirectory}/focus-first-setting-control.ts`,
  },
  {
    find: "@/ui/components/SettingsEmptyState",
    replacement: `${packagesUiDirectory}/SettingsEmptyState.tsx`,
  },
  {
    find: "@/ui/components/SettingsControlCard",
    replacement: `${packagesUiDirectory}/SettingsControlCard.tsx`,
  },
  {
    find: "@/ui/components/SettingsHelpCard",
    replacement: `${packagesUiDirectory}/SettingsHelpCard.tsx`,
  },
  {
    find: "@/ui/components/SettingsSectionCard",
    replacement: `${packagesUiDirectory}/SettingsSectionCard.tsx`,
  },
  {
    find: "@/ui/components/SettingsSubcard",
    replacement: `${packagesUiDirectory}/SettingsSubcard.tsx`,
  },
  {
    find: "@/ui/components/ContainerBadge",
    replacement: `${packagesUiDirectory}/ContainerBadge.tsx`,
  },
  {
    find: "@/ui/options/components/AnchorHeading",
    replacement: `${packagesUiDirectory}/AnchorHeading.tsx`,
  },
  {
    find: "@",
    replacement: srcDirectory,
  },
] as const;
