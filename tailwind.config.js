/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#fdfcfa',
          100: '#faf8f5',
          200: '#f5f0eb',
          300: '#ebe5dd',
          400: '#d9d0c5',
          500: '#b8ad9e',
          600: '#978b7b',
          700: '#78716c',
          800: '#57534e',
          900: '#1c1917',
        },
      },
    },
  },
  plugins: [],
}
