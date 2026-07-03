/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        pe: {
          canvas: 'var(--pe-canvas)',
          surface: 'var(--pe-surface)',
          elevated: 'var(--pe-elevated)',
          sidebar: 'var(--pe-sidebar)',
          text: 'var(--pe-text)',
          'text-secondary': 'var(--pe-text-secondary)',
          'text-muted': 'var(--pe-text-muted)',
          border: 'var(--pe-border)',
          'border-strong': 'var(--pe-border-strong)',
          accent: 'var(--pe-accent)',
          positive: 'var(--pe-positive)',
          negative: 'var(--pe-negative)',
          warning: 'var(--pe-warning)',
          ticker: 'var(--pe-ticker)',
        },
      },
      maxWidth: {
        feed: '40rem',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
