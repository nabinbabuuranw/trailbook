/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17261F',
        bone: '#F1ECE1',
        paper: '#F8F5EE',
        spruce: { DEFAULT: '#2D5A4C', deep: '#1F4035', soft: '#D8E2CB' },
        blaze: { DEFAULT: '#B5531F', ink: '#8F3E14' },
        slate: '#3C5A73',
        stone: '#5E594E',
        rule: '#CFC6B2',
        danger: '#9E2B22',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '2px' },
    },
  },
  plugins: [],
};
