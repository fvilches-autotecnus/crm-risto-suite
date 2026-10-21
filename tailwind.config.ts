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
    },
  },
  plugins: [],
}
export default config
