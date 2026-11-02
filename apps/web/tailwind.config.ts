import type { Config } from 'tailwindcss';

// Design tokens taken from the approved prototype (:root variables and computed styles).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Preflight is off: the prototype's own base styles (ported in styles/legacy.css) define the look.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#006B35',
          green2: '#0A7A42',
          deep: '#003D22',
          gold: '#F5B900',
          gold2: '#FFD34A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
