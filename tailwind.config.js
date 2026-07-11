/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // The app's one green — the same green as the goal-progress bar on
      // the Me page. Every `emerald-*` / `text-emerald-*` / `bg-emerald-*`
      // class anywhere in the app resolves through this scale — to
      // change the brand green, edit these 11 lines and nothing else.
      // 400/500 match that bar's two gradient stops exactly.
      colors: {
        emerald: {
          50:  'oklch(0.98 0.03 152)',
          100: 'oklch(0.95 0.06 152)',
          200: 'oklch(0.90 0.10 152)',
          300: 'oklch(0.84 0.15 151)',
          400: 'oklch(0.78 0.19 150)',
          500: 'oklch(0.68 0.18 152)',
          600: 'oklch(0.60 0.17 152)',
          700: 'oklch(0.50 0.15 153)',
          800: 'oklch(0.42 0.12 153)',
          900: 'oklch(0.36 0.10 154)',
          950: 'oklch(0.24 0.06 154)',
        },
      },
    },
  },
  plugins: [],
}
