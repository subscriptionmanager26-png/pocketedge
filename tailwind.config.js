/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        label: ['Barlow', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
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
          'accent-bright': 'var(--pe-accent-bright)',
          'accent-pressed': 'var(--pe-accent-pressed)',
          'accent-wash': 'var(--pe-accent-wash)',
          'accent-border': 'var(--pe-accent-border)',
          link: 'var(--pe-link)',
          positive: 'var(--pe-positive)',
          negative: 'var(--pe-negative)',
          warning: 'var(--pe-warning)',
          ticker: 'var(--pe-ticker)',
          ink: 'var(--pe-ink)',
        },
      },
      maxWidth: {
        feed: '40rem',
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
