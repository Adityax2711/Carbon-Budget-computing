/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0B1120',
          sidebar: '#0F172A',
          card: '#131F32',
          cardHover: '#182740',
          border: '#273449',
          borderLight: '#33435C',
          textPrimary: '#F8FAFC',
          textSecondary: '#94A3B8',
          green: '#4ADE80',
          purple: '#8B7CFF',
          blue: '#60A5FA',
          warning: '#FBBF24',
          error: '#F87171',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
