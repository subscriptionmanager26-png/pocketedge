/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        pe: {
          canvas: 'var(--pe-canvas)',
          surface: 'var(--pe-surface)',
          elevated: 'var(--pe-elevated)',
          text: 'var(--pe-text)',
          'text-secondary': 'var(--pe-text-secondary)',
          'text-muted': 'var(--pe-text-muted)',
          border: 'var(--pe-border)',
          accent: 'var(--pe-accent)',
          positive: 'var(--pe-positive)',
          negative: 'var(--pe-negative)',
          warning: 'var(--pe-warning)',
          ticker: 'var(--pe-ticker)',
        },
      },
    },
  },
  plugins: [],
};
