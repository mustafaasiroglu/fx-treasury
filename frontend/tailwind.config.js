/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#0b1018',
        surface: '#121a27',
        'surface-2': '#182235',
        'surface-3': '#202c43',
        panel: '#182235',
        border: '#2c3a55',
        ink: '#eef4ff',
        accent: '#7ce3bc',
        'accent-dim': '#4fb79a',
        mint: '#7ce3bc',
        yellow: '#ffd84d',
        green: '#60d36f',
        red: '#ff6870',
        orange: '#ffad4d',
        purple: '#9b6cff',
        blue: '#68a5ff',
        danger: '#ff6870',
        warning: '#ffad4d',
        muted: '#90a0ba',
        subtle: '#65738a',
      },
      animation: {
        pulse: 'pulse 1.5s ease-in-out infinite',
        'blink': 'blink 1s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};
