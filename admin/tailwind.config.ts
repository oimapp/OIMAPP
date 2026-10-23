import type { Config } from "tailwindcss";

// Colours taken from the church logo.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#14228C", deep: "#0B145E", soft: "#E8EAF8" },
        church: { red: "#B3142B", soft: "#FBE9EC" },
        ink: "#171A33",
        muted: "#545972",
        line: "#DCDFEC",
        paper: "#F4F5FA",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Segoe UI", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
