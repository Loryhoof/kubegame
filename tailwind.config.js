/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // main HTML file for Vite
    "./src/ui/**/*.{js,ts,jsx,tsx}", // only your React components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
