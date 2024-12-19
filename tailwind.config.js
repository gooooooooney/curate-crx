/** @type {import('tailwindcss').Config} */
const {nextui} = require("@nextui-org/react")

module.exports = {
  mode: "jit",
  darkMode: "class",
  content: [
    "./contents/**/*.{ts,tsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",

  ],
  plugins: [
    nextui()
  ]
}