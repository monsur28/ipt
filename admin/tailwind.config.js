/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#0b1326",
        surface: {
          DEFAULT: "#0b1326",
          light: "#131b2e",
          card: "rgba(19, 27, 46, 0.7)",
        },
        primary: {
          DEFAULT: "#e11d48", // Sports Red
          container: "#ffb3b6",
        },
        secondary: {
          DEFAULT: "#10b981", // Emerald Green
          container: "#00a572",
        },
        warning: {
          DEFAULT: "#f59e0b", // Amber
        }
      },
    },
  },
  plugins: [],
}
