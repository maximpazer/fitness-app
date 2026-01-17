/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Pre-included directory content options should be verified
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
