import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [path.join(root, 'index.html'), path.join(root, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'Prompt', 'sans-serif'],
        display: ['Prompt', '"IBM Plex Sans Thai"', 'sans-serif'],
      },
      colors: {
        ink: '#07111f',
        navy: {
          950: '#06101f',
          900: '#071833',
          800: '#0e2a5c',
          700: '#16357a',
          600: '#1d4ed8',
        },
        gold: {
          200: '#ffe7a3',
          300: '#ffd56a',
          400: '#f5c542',
          500: '#e2ae22',
        },
        court: '#d6ff4a',
      },
      boxShadow: {
        lift: '0 24px 60px -28px rgba(7, 24, 51, 0.55)',
      },
    },
  },
  plugins: [],
}
