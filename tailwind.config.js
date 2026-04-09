/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        fairway: {
          50:  '#f0faf0',
          100: '#d4f0d4',
          200: '#a8e0a8',
          300: '#6bc96b',
          400: '#3aad3a',
          500: '#1e7a1e',
          600: '#165c16',
          700: '#124712',
          800: '#0e360e',
          900: '#0a260a',
          950: '#061806',
        },
        sand: {
          50:  '#fdfaf5',
          100: '#f9f0de',
          200: '#f2e0b8',
          300: '#e8c987',
          400: '#ddb057',
          500: '#c9952e',
          600: '#a87822',
          700: '#845c1a',
          800: '#644516',
          900: '#4a3312',
        },
        clubhouse: {
          50:  '#faf9f7',
          100: '#f0ede8',
          200: '#e0dbd0',
          300: '#c9c0ae',
          400: '#b0a38a',
          500: '#96856a',
          600: '#7a6c55',
          700: '#615544',
          800: '#4a4134',
          900: '#362f26',
          950: '#1e1b16',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
