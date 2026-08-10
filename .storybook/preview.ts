import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react";

import { withBrandStoryFrame } from "./PrivacyThingStoryFrame";
import "../src/ui/styles/globals.css";

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
    withBrandStoryFrame,
  ],
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
    controls: { expanded: true },
    a11y: {
      test: "error",
    },
  },
};

export default preview;
