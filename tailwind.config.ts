import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:         '#ede9e2',
        surface:    '#ffffff',
        surface2:   '#f5f2ed',
        surface3:   '#faf9f7',
        noir:       '#16130e',
        noir2:      '#2e2b25',
        'gris-dk':  '#5a564e',
        gris:       '#8a8478',
        'gris-lt':  '#c2bdb4',
        'border-dk':'#b8b0a4',
        border:     '#d8d2c8',
        'border-lt':'#ede9e2',
        or:         '#9a7a28',
        'or-light': '#c9a84c',
        'or-bg':    '#fdf6e3',
        vert:       '#1e5e3a',
        'vert-bg':  '#eaf4ee',
        rouge:      '#9e2a2a',
        'rouge-bg': '#faeaea',
        bleu:       '#1e3f70',
        'bleu-bg':  '#e8eef8',
        amber:      '#7a5c10',
        'amber-bg': '#fdf3dc',
        violet:     '#4a2a6e',
        'violet-bg':'#f0ebfa',
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Cormorant Garamond', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
    },
  },
  plugins: [],
}

export default config
