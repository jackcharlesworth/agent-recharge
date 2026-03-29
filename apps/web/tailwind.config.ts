import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // LayerZero purple (primary accent)
        brand: {
          DEFAULT: "#a77dff",
          dark: "#8b5cf6",
          "8p": "#16131d",
          "12p": "#1d1828",
          "25p": "#312647",
        },
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
