/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#09090d",
        panel: "#111118",
        blood: "#e11d48",
        ember: "#fb7185",
        moon: "#d7d5ff",
        mist: "#9896ad"
      },
      boxShadow: {
        glow: "0 0 50px rgba(225,29,72,.18)",
        panel: "0 25px 70px rgba(0,0,0,.35)"
      }
    }
  },
  plugins: []
};
