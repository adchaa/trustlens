/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        verified: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#047857'
        },
        uncertain: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#b45309'
        },
        suspicious: {
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#b91c1c'
        }
      }
    },
  },
  plugins: [],
}
