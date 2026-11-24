/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  safelist: ['badge-success', 'badge-warning', 'badge-danger', 'badge-info'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        errorLight: '#fca5a5',
      },
    },
  },
  plugins: [],
};
