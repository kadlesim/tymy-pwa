/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          hover: 'var(--color-primary-hover)',
          dark: 'var(--color-primary-dark)'
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          light: 'var(--color-secondary-light)',
          hover: 'var(--color-secondary-hover)'
        },
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)'
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)'
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          light: 'var(--color-danger-light)'
        },
        info: {
          DEFAULT: 'var(--color-info)',
          light: 'var(--color-info-light)'
        },
        elevated: 'var(--color-bg-elevated)',
        text: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)'
        },
        50: 'var(--color-50)',
        100: 'var(--color-100)',
        200: 'var(--color-200)',
        300: 'var(--color-300)',
        400: 'var(--color-400)',
        500: 'var(--color-500)',
        600: 'var(--color-600)',
        700: 'var(--color-700)',
        800: 'var(--color-800)',
        900: 'var(--color-900)',
        950: 'var(--color-950)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      zIndex: {
        60: '60'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
