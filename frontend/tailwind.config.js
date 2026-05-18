/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0a0b10',
          900: '#12141c',
          800: '#1c1f2b',
          700: '#2a2f3f',
        },
        gold: {
          400: '#f5c451',
          500: '#e8a820',
          600: '#c98a12',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(245, 196, 81, 0.15)',
        panel: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
};
