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
        primary: {
          DEFAULT: "#292b7f",
          50: "#eeeef7",
          100: "#d5d6eb",
          200: "#abadda",
          300: "#8184c8",
          400: "#575bb7",
          500: "#292b7f",
          600: "#222466",
          700: "#1a1c4d",
          800: "#131433",
          900: "#0b0c1a",
        },
        secondary: {
          DEFAULT: "#62c6f9",
          50: "#e8f7fe",
          100: "#d1effd",
          200: "#a3dffb",
          300: "#75cff9",
          400: "#62c6f9",
          500: "#47bff7",
          600: "#1aa8e8",
          700: "#1486b9",
          800: "#0f658a",
          900: "#0a435c",
        },
        accent: {
          DEFAULT: "#a32199",
          50: "#fae8f8",
          100: "#f5d1f1",
          200: "#eba3e3",
          300: "#e175d5",
          400: "#c93dbe",
          500: "#a32199",
          600: "#821a7a",
          700: "#62145c",
          800: "#410d3d",
          900: "#21071f",
        },
        cta: {
          DEFAULT: "#ba281e",
          50: "#fbeae9",
          100: "#f7d5d3",
          200: "#efaba7",
          300: "#e7817b",
          400: "#df574f",
          500: "#ba281e",
          600: "#952018",
          700: "#701812",
          800: "#4a100c",
          900: "#250806",
        },
        dark: "#20211c",
        gray: {
          DEFAULT: "#959595",
          50: "#f7f7f7",
          100: "#ededed",
          200: "#dfdfdf",
          300: "#c8c8c8",
          400: "#adadad",
          500: "#959595",
          600: "#7a7a7a",
          700: "#636363",
          800: "#525252",
          900: "#464646",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};

export default config;
