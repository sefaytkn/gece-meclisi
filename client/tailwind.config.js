/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070708",
        panel: "#121013",
        blood: "#8f1d2c",
        ember: "#c54a57",
        moon: "#eee8dc",
        mist: "#a9a195",
        bone: "#eee8dc",
        gold: "#bda56a"
      },
      boxShadow: {
        glow: "0 0 50px rgba(143,29,44,.24)",
        panel: "0 25px 70px rgba(0,0,0,.48)"
      }
    }
  },
  plugins: []
};
