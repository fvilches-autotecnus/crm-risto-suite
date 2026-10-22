import type { Config } from 'tailwindcss'

// Identidad Risto Suite (tomada del portal CRM de reservas.ristosuite.app/crm):
// negro + verde lima, tarjetas verde muy oscuro, texto crema-verdoso.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rs: {
          bg: '#000000',
          header: '#0a1100',
          card: '#131d03',
          raised: '#1a2504',
          border: '#1f2d03',
          control: '#253300',
          input: '#0d1400',
          text: '#f0f4e8',
          muted: '#7a9050',
          lime: '#c8e62b',
          'on-lime': '#0d1400',
          ok: '#5ecc6e',
          lav: '#a5b4fc',
          warn: '#f5b942',
          danger: '#f0706b',
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
