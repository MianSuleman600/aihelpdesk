import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

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
        "on-surface": "#e4e1ed",
        "surface-variant": "#34343d",
        "on-error-container": "#ffdad6",
        "error-container": "#93000a",
        "surface-container-highest": "#34343d",
        "on-primary-container": "#0d0096",
        "inverse-surface": "#e4e1ed",
        "on-secondary": "#3c0091",
        "surface-container-high": "#292932",
        "error": "#ffb4ab",
        "secondary-container": "#571bc1",
        "primary-fixed-dim": "#c0c1ff",
        "surface": "#13131b",
        "surface-container-low": "#1b1b23",
        "on-tertiary-fixed-variant": "#703700",
        "tertiary": "#ffb783",
        "on-primary-fixed-variant": "#2f2ebe",
        "on-secondary-fixed": "#23005c",
        "inverse-on-surface": "#303038",
        "background": "#13131b",
        "surface-bright": "#393841",
        "secondary-fixed": "#e9ddff",
        "on-error": "#690005",
        "on-surface-variant": "#c7c4d7",
        "primary-fixed": "#e1e0ff",
        "secondary-fixed-dim": "#d0bcff",
        "secondary": "#d0bcff",
        "on-tertiary-fixed": "#301400",
        "tertiary-container": "#d97721",
        "outline-variant": "#464554",
        "on-background": "#e4e1ed",
        "on-primary": "#1000a9",
        "outline": "#908fa0",
        "on-secondary-fixed-variant": "#5516be",
        "tertiary-fixed-dim": "#ffb783",
        "on-secondary-container": "#c4abff",
        "on-tertiary": "#4f2500",
        "primary-container": "#8083ff",
        "on-tertiary-container": "#452000",
        "surface-container": "#1f1f27",
        "on-primary-fixed": "#07006c",
        "tertiary-fixed": "#ffdcc5",
        "inverse-primary": "#494bd6",
        "surface-container-lowest": "#0d0d15",
        "surface-dim": "#13131b",
        "primary": "#c0c1ff",
        "surface-tint": "#c0c1ff"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px",
        "2xl": "1rem",
        "3xl": "1.5rem"
      },
      spacing: {
        "stack-lg": "32px",
        "stack-md": "16px",
        "container-padding": "24px",
        "bento-gap": "20px",
        "gutter": "16px",
        "unit": "8px",
        "stack-sm": "8px"
      },
      fontFamily: {
        "headline-lg-mobile": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "headline-xl": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "label-caps": ["Inter", "sans-serif"],
        "sans": ["Inter", "sans-serif"]
      },
      fontSize: {
        "headline-lg-mobile": ["28px", {"lineHeight": "36px", "fontWeight": "600"}],
        "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "400"}],
        "body-sm": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "headline-md": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "headline-xl": ["48px", {"lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "headline-lg": ["32px", {"lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "600"}],
        "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600"}]
      },
      animation: {
        'spring-bounce': 'spring-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'gradient-shift': 'gradient-shift 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s infinite linear',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;