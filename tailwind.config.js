/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./*.js"],
  theme: {
    extend: {
      fontFamily: { headline: ['Manrope','sans-serif'] },
      colors: {
        primary: '#1a6b2e',
        'primary-light': '#2d8a47',
        'primary-dark': '#0f4a1f',
        secondary: '#e8a020',
        surface: '#f5f0e8',
        danger: '#dc2626',
        success: '#16a34a',
        warning: '#f59e0b'
      }
    }
  },
  plugins: [],
}
