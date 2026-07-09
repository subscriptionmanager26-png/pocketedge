/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
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
        // Substack centers the feed column; ~640px reads well beside a 232px nav.
        feed: '40rem',
      },
    },
  },
  plugins: [],
};
