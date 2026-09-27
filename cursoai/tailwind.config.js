/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe7ff',
          500: '#4f6ef7',
          600: '#3f55e0',
          700: '#3343b8',
          900: '#1c2461',
        },
      },
    },
  },
  plugins: [],
};
