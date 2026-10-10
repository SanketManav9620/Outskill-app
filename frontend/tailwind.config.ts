import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: "#f8f7fa",
        lavenderSoft: "#c7bcd3",
        navyDark: "#23456c",
        purpleBrand: "#6e2a7e",
        purpleHover: "#582165",
        blueAccent: "#5e80c4",
        borderSoft: "#e2deea",
        mutedText: "#627289",
      },
    },
  },
  plugins: [],
};
export default config;
