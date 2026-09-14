/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-invert': 'rgb(var(--ink-invert) / <alpha-value>)',
        'on-gold': 'rgb(var(--on-gold) / <alpha-value>)',
        paper: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-soft': 'rgb(var(--surface-soft) / <alpha-value>)',
        gold: {
          DEFAULT: 'rgb(var(--gold) / <alpha-value>)',
          strong: 'rgb(var(--gold-strong) / <alpha-value>)',
          soft: 'rgb(var(--gold) / 0.12)',
        },
        line: 'rgb(var(--border) / <alpha-value>)',
        muted: 'rgb(var(--text-soft) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
};
