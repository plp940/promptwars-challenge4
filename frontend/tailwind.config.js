/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                darkBg: '#0b0c10',
                darkSurface: '#1f2833',
                neonCyan: '#66fcf1',
                neonBlue: '#45f3ff',
                neonGreen: '#39ff14',
                neonYellow: '#ffea00',
                neonRed: '#ff003c',
                darkMuted: '#c5c6c7'
            },
            fontFamily: {
                sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
