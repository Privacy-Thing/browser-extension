import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: {
      config: path.join(configDirectory, "tailwind.config.ts"),
    },
    autoprefixer: {},
  },
};
