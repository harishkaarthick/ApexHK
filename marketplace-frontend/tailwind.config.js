/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#f8fafc',
          dark: '#0a0a0f',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#12121a',
        },
        border: {
          DEFAULT: '#e2e8f0',
          dark: '#1e1e2e',
        },
        foreground: {
          DEFAULT: '#0f172a',
          dark: '#e2e8f0',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        primary: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        accent: {
          indigo: '#6366f1',
          purple: '#8b5cf6',
        },
        brand: {
          DEFAULT: '#6366f1',
          dark:    '#4f46e5',
          light:   '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.10)',
        'card-hover': '0 12px 40px rgba(99,102,241,0.18)',
        glow: '0 0 20px rgba(99,102,241,0.35)',
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-32px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(99,102,241,0)' },
          '50%': { boxShadow: '0 0 20px rgba(99,102,241,0.35)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        shimmer: 'shimmer 1.5s linear infinite',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
