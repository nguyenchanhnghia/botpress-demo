/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
        './app/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: '#ed1823',
                secondary: '#ffd234',
            },
            gradientColorStops: theme => ({
                ...theme('colors'),
                primary: '#ed1823',
                secondary: '#ffd234',
            }),
        },
    },
    plugins: [],
}; 