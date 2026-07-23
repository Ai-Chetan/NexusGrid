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
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'highlight-pulse': 'highlightPulse 4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        highlightPulse: {
          '0%':   { boxShadow: 'inset 0 0 0 2px #f59e0b' },
          '25%':  { boxShadow: 'inset 0 0 0 3px #f59e0b, 0 0 8px #f59e0b66' },
          '50%':  { boxShadow: 'inset 0 0 0 2px #f59e0b' },
          '75%':  { boxShadow: 'inset 0 0 0 3px #f59e0b, 0 0 8px #f59e0b66' },
          '100%': { boxShadow: 'none' },
        },
      },
    },
  },
  plugins: [],
}
