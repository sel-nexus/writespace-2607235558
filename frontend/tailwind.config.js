/** Define a light, warm-paper editorial language with one ink-green accent. */
const neutral = {
  50: 'oklch(0.98 0.008 85)', 100: 'oklch(0.94 0.009 85)',
  200: 'oklch(0.86 0.010 85)', 300: 'oklch(0.78 0.010 85)',
  400: 'oklch(0.68 0.010 85)', 500: 'oklch(0.57 0.010 85)',
  600: 'oklch(0.46 0.010 85)', 700: 'oklch(0.36 0.010 85)',
  800: 'oklch(0.27 0.009 85)', 900: 'oklch(0.20 0.008 85)',
  950: 'oklch(0.14 0.006 85)',
};
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f8f6f0', surface: '#fffdf8', 'surface-raised': '#efede6',
        foreground: '#242c27', 'foreground-muted': '#5d635a', border: '#d6d6ca', ring: '#285644',
        primary: {
          50: 'oklch(0.97 0.015 160)', 100: 'oklch(0.92 0.025 160)',
          200: 'oklch(0.85 0.040 160)', 300: 'oklch(0.76 0.050 160)',
          400: 'oklch(0.66 0.060 160)', 500: 'oklch(0.55 0.065 160)',
          600: '#285644', 700: '#204536', 800: 'oklch(0.31 0.040 160)',
          900: 'oklch(0.23 0.030 160)', 950: 'oklch(0.16 0.020 160)',
        },
        secondary: neutral, neutral,
        success: { DEFAULT: '#346538', foreground: '#346538', light: '#edf3ec' },
        warning: { DEFAULT: '#72521e', foreground: '#72521e', light: '#fbf3db' },
        error: { DEFAULT: '#9f2f2d', foreground: '#9f2f2d', light: '#fdebec' },
        info: { DEFAULT: '#405a64', foreground: '#405a64', light: '#edf1f2' },
      },
      fontFamily: {
        sans: ['"Trebuchet MS"', '"Gill Sans"', 'sans-serif'],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      fontSize: { hero: ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }] },
      spacing: { section: '5rem' },
      borderRadius: { control: '0.375rem' },
      boxShadow: { overlay: '0 4px 16px rgb(36 44 39 / 0.08)' },
      transitionDuration: { quick: '150ms' },
      transitionTimingFunction: { functional: 'ease-out' },
    },
  },
  plugins: [],
};
