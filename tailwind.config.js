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
          canvas: '#F7F7F5',
          surface: '#FFFFFF',
          text: '#171717',
          'text-secondary': '#525252',
          'text-muted': '#737373',
          border: '#E5E5E5',
          accent: '#00C853',
          'accent-bright': '#00FF6A',
          positive: '#059669',
          negative: '#E11D48',
          warning: '#E97A50',
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
