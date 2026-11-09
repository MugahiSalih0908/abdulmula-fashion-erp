/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#145231',
        },
        brand: { DEFAULT: '#151515', light: '#202020', gold: '#C5A46D' },
        luxury: {
          black: '#151515',
          charcoal: '#202020',
        },
        champagne: {
          DEFAULT: '#C5A46D',
          light: '#E8D9BD',
        },
        warm: {
          DEFAULT: '#FAF9F6',
          white: '#FAF9F6',
        },
        ink: {
          DEFAULT: '#252525',
          secondary: '#727272',
        },
        border: {
          DEFAULT: '#EAE7E0',
        },
        accent: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#06b6d4',
        },
        charcoal: {
          50: '#FAF9F6',
          100: '#F3F1EC',
          200: '#EAE7E0',
          300: '#D8D4CC',
          400: '#A9A49B',
          500: '#777777',
          600: '#5F5B55',
          700: '#3F3C38',
          800: '#252525',
          900: '#151515',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'soft': '0 1px 2px rgb(37 37 37 / 0.04)',
        'soft-md': '0 2px 8px rgb(37 37 37 / 0.06)',
        'glass': '0 4px 16px rgb(37 37 37 / 0.08)',
        'glass-lg': '0 16px 40px rgb(37 37 37 / 0.12)',
      },
      animation: {
        'slide-up': 'slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in': 'fadeIn 250ms ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      }
    }
  },
  plugins: []
};
