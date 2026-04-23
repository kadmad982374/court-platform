/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Conservative, government-style palette.
        brand: {
          50:  '#eef4fb',
          100: '#d6e6f4',
          500: '#1d4f8b',
          600: '#174072',
          700: '#11325a',
          900: '#0a1f3a',
        },
        muted: {
          DEFAULT: '#f3f4f6',
          foreground: '#6b7280',
        },
        border: '#e5e7eb',
      },
      fontFamily: {
        sans: ['"Noto Sans Arabic"', '"Segoe UI"', 'Tahoma', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
    },
  },
  plugins: [],
};

