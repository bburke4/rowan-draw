/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          dark: '#0b0f17',
          surface: '#161f2e',
          border: '#243044',
          amber: '#f59e0b',
          emerald: '#10b981',
          coral: '#ef4444',
          sky: '#0284c7',
        }
      }
    },
  },
  plugins: [],
}
