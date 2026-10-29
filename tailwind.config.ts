import type { Config } from 'tailwindcss'

// Identidad Risto Suite (tomada del portal CRM de reservas.ristosuite.app/crm):
// negro + verde lima, tarjetas verde muy oscuro, texto crema-verdoso.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rs: {
          bg: 'rgb(var(--rs-bg) / <alpha-value>)',
          header: 'rgb(var(--rs-header) / <alpha-value>)',
          card: 'rgb(var(--rs-card) / <alpha-value>)',
          raised: 'rgb(var(--rs-raised) / <alpha-value>)',
          border: 'rgb(var(--rs-border) / <alpha-value>)',
          control: 'rgb(var(--rs-control) / <alpha-value>)',
          input: 'rgb(var(--rs-input) / <alpha-value>)',
          text: 'rgb(var(--rs-text) / <alpha-value>)',
          muted: 'rgb(var(--rs-muted) / <alpha-value>)',
          lime: 'rgb(var(--rs-lime) / <alpha-value>)',
          'on-lime': 'rgb(var(--rs-on-lime) / <alpha-value>)',
          ok: 'rgb(var(--rs-ok) / <alpha-value>)',
          lav: 'rgb(var(--rs-lav) / <alpha-value>)',
          warn: 'rgb(var(--rs-warn) / <alpha-value>)',
          danger: 'rgb(var(--rs-danger) / <alpha-value>)',
        },
      },
      borderRadius: { rs: '10px', 'rs-lg': '16px' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'translateY(8px) scale(.96)' }, '100%': { opacity: '1', transform: 'none' } },
        'slide-in': { '0%': { opacity: '0', transform: 'translateX(24px)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'toast-bar': { '0%': { transform: 'scaleX(1)' }, '100%': { transform: 'scaleX(0)' } },
        flash: { '0%': { backgroundColor: 'rgba(200,230,43,.28)' }, '100%': { backgroundColor: 'transparent' } },
        'grow-y': { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
        'grow-x': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        draw: { '0%': { strokeDashoffset: '1' }, '100%': { strokeDashoffset: '0' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(3%,-3%,0)' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .25s ease-out both',
        'scale-in': 'scale-in .22s cubic-bezier(.22,1,.36,1) both',
        'slide-in': 'slide-in .3s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.4s infinite',
        flash: 'flash 1.6s ease-out both',
        drift: 'drift 14s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
