import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  // Tailwind resolves plain content globs against the process cwd, not this
  // config file. After moving configs under `config/`, force relative mode so
  // Vite, Storybook, and direct PostCSS/Tailwind entrypoints scan the same files.
  content: {
    relative: true,
    files: [
      "../.storybook/**/*.{ts,tsx,mdx}",
      "../src/ui/**/*.{ts,tsx,html}",
      "../packages/ui/src/**/*.{ts,tsx}",
    ],
  },
  theme: {
    extend: {
      fontFamily: {
        // ui-sans-serif → SF Pro (macOS/iOS) / Segoe UI Variable (Win11) / system-ui
        // This is the exact font stack Linear, Vercel, and Raycast use on most platforms.
        sans: [
          "ui-sans-serif",
          "-apple-system",
          '"Segoe UI Variable Display"',
          '"Segoe UI"',
          "system-ui",
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', "ui-monospace", '"Fira Code"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      letterSpacing: {
        tighter: "-0.04em",
        tight: "-0.02em",
        snug: "-0.01em",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        tone: {
          info: {
            bg: "hsl(var(--tone-info-bg))",
            text: "hsl(var(--tone-info-text))",
            border: "hsl(var(--tone-info-border))",
          },
          success: {
            bg: "hsl(var(--tone-success-bg))",
            text: "hsl(var(--tone-success-text))",
            border: "hsl(var(--tone-success-border))",
          },
          error: {
            bg: "hsl(var(--tone-error-bg))",
            text: "hsl(var(--tone-error-text))",
            border: "hsl(var(--tone-error-border))",
          },
          warning: {
            bg: "hsl(var(--tone-warning-bg))",
            text: "hsl(var(--tone-warning-text))",
            border: "hsl(var(--tone-warning-border))",
          },
          neutral: {
            bg: "hsl(var(--tone-neutral-bg))",
            text: "hsl(var(--tone-neutral-text))",
            border: "hsl(var(--tone-neutral-border))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "card-dark": "0 1px 3px rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.3)",
        "card-light": "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        elevated: "0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
} satisfies Config;
