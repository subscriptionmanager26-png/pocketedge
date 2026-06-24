/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        label: ['Barlow', 'system-ui', 'sans-serif'],
      },
      colors: {
        pe: {
          canvas: 'var(--pe-canvas)',
          surface: 'var(--pe-surface)',
          text: 'var(--pe-text)',
          'text-secondary': 'var(--pe-text-secondary)',
          'text-muted': 'var(--pe-text-muted)',
          border: 'var(--pe-border)',
          accent: 'var(--pe-accent)',
          'accent-bright': 'var(--pe-accent-bright)',
          positive: 'var(--pe-positive)',
          negative: 'var(--pe-negative)',
          warning: 'var(--pe-warning)',
        },
      },
      animation: {
        'gradient-x': 'gradient-x 3s ease infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
          '50%': { 'background-size': '200% 200%', 'background-position': 'right center' },
        },
      },
    },
  },
  plugins: [],
};
