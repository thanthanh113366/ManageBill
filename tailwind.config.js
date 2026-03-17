/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        badgePop:     { '0%': { transform: 'scale(0)' }, '70%': { transform: 'scale(1.3)' }, '100%': { transform: 'scale(1)' } },
        bump:         { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.35)' }, '100%': { transform: 'scale(1)' } },
        slideInRight: { '0%': { transform: 'translateX(8px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        fadeSlideUp:  { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'badge-pop':      'badgePop 200ms ease-out',
        'bump':           'bump 180ms ease-out',
        'slide-in-right': 'slideInRight 180ms ease-out',
        'fade-slide-up':  'fadeSlideUp 250ms ease-out both',
      },
    },
  },
  plugins: [],
} 