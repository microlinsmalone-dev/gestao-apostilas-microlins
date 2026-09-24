import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        microlins: {
          blue: '#0f3b7d',
          'blue-dark': '#0a2e68',
          'blue-light': '#1e54a4',
          red: '#d91a2a',
          'red-light': '#fce8e8',
          'red-dark': '#b31522',
        },
        alert: {
          bg: '#fce8e6',
          text: '#c5221f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
