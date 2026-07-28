import type { Config } from "tailwindcss";

const variable = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: variable("--slate-50"),
          100: variable("--slate-100"),
          200: variable("--slate-200"),
          300: variable("--slate-300"),
          400: variable("--slate-400"),
          500: variable("--slate-500"),
          600: variable("--slate-600"),
          700: variable("--slate-700"),
          800: variable("--slate-800"),
          900: variable("--slate-900"),
          950: variable("--slate-950"),
        },
        white: variable("--strong-text"),
        surface: {
          DEFAULT: variable("--surface"),
          raised: variable("--surface-raised"),
          border: variable("--surface-border"),
        },
        accent: {
          DEFAULT: variable("--accent"),
          muted: variable("--accent-muted"),
        },
      },
    },
  },
  plugins: [],
};

export default config;
