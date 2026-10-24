// Colours taken from the church logo, in a light and a dark version.

export type Colors = {
  brand: string; deep: string; soft: string; red: string; redSoft: string;
  ink: string; muted: string; line: string; paper: string; card: string;
  green: string; greenSoft: string; onBrand: string; hero: string; heroText: string;
  watermark: string; dark: boolean;
};

export const LIGHT: Colors = {
  brand: "#14228C", deep: "#0B145E", soft: "#E8EAF8", red: "#B3142B", redSoft: "#FBE9EC",
  ink: "#171A33", muted: "#545972", line: "#DCDFEC", paper: "#F4F5FA", card: "#FFFFFF",
  green: "#1E7B46", greenSoft: "#E6F4EC", onBrand: "#FFFFFF", hero: "#0B145E", heroText: "#FFFFFF",
  watermark: "rgba(20, 34, 140, 0.07)", dark: false,
};

export const DARK: Colors = {
  brand: "#9AA6FF", deep: "#C9CFFF", soft: "#1B2258", red: "#FF7A8A", redSoft: "#3A1520",
  ink: "#ECEEF8", muted: "#AAB0D0", line: "#2A3168", paper: "#0D1130", card: "#151A42",
  green: "#6FE0A0", greenSoft: "#123A24", onBrand: "#0D1130", hero: "#1B2258", heroText: "#FFFFFF",
  watermark: "rgba(200, 210, 255, 0.07)", dark: true,
};

export const serif = "serif";
