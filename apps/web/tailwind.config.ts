import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7B5CF0",
          dark: "#5A3FD4",
        },
      },
    },
  },
  plugins: [],
};

export default config;
