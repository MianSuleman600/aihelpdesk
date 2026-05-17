import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surface colors
        surface: '#13131b',
        'surface-dim': '#13131b',
        'surface-bright': '#393841',
        'surface-container-lowest': '#0d0d15',
        'surface-container-low': '#1b1b23',
        'surface-container': '#1f1f27',
        'surface-container-high': '#292932',
        'surface-container-highest': '#34343d',
        'on-surface': '#e4e1ed',
        'on-surface-variant': '#c7c4d7',
        outline: '#908fa0',
        'outline-variant': '#464554',
        background: '#13131b',
        'on-background': '#e4e1ed',
        'surface-variant': '#34343d',

        // Brand colors (violet) - primary
        brand: {
          50: '#F4F1FF',
          100: '#EAE4FF',
          200: '#D4C9FF',
          300: '#BEAEFF',
          400: '#9B85F5',
          500: '#7C5CFA',
          600: '#6340E8',
          700: '#4D2EC4',
          800: '#36209A',
          900: '#221370',
        },

        // Accent colors (amber)
        accent: {
          300: '#FCD97A',
          400: '#F5B942',
          500: '#E89B1A',
          600: '#C47A0A',
          700: '#9C5D06',
        },

        // Status colors
        success: '#10b981',
        'success-dark': '#059669',
        warning: '#f59e0b',
        'warning-dark': '#d97706',
        danger: '#f43f5e',
        'danger-dark': '#e11d48',
        info: '#6366f1',

        // Primary/Secondary (mapped to brand)
        primary: '#7C5CFA',
        'primary-hover': '#6340E8',
        secondary: '#d0bcff',
        tertiary: '#F5B942',

        // Error
        error: '#ffb4ab',
        'on-error': '#690005',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'headline-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '600' }],
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      spacing: {
        unit: '8px',
        gutter: '16px',
        'container-padding': '24px',
        'bento-gap': '20px',
      },
      backdropFilter: {
        'blur-glass': 'blur(12px)',
      },
      animation: {
        'spring-bounce': 'spring-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'gradient-shift': 'gradient-shift 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        'spring-bounce': {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7C5CFA 0%, #9B85F5 100%)',
        'gradient-accent': 'linear-gradient(135deg, #F5B942 0%, #FCD97A 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #7C5CFA 0%, #4D2EC4 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      },
      boxShadow: {
        'glass-inner': 'inset 1px 1px 0 rgba(255,255,255,0.1), inset -1px -1px 0 rgba(255,255,255,0.05)',
        'glass-border': '0 0 0 1px rgba(255,255,255,0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;