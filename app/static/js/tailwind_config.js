tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        bnb: {
          ink: 'var(--bnb-ink)',
          surface: 'var(--bnb-surface)',
          purple: 'var(--bnb-purple)',
          cyan: 'var(--bnb-cyan)',
          muted: 'var(--bnb-muted)',
        },
        'light-primary': '#ffffff',
        'dark-primary': '#16131f',
        'light-text': '#1a1528',
        'dark-text': '#f4f2f8',
        light: {
          primary: '#ffffff',
          secondary: '#f0ebf7',
          accent: '#0e8fa3',
          text: '#1a1528',
        },
        dark: {
          '50': '#f4f2f8',
          '100': '#1e1a2a',
          '200': '#1a1f35',
          '300': '#16131f',
          '400': '#100e18',
          '500': '#0b101f',
          '600': '#090c19',
          '700': '#100e18',
          '800': '#07060c',
          '900': '#05040a',
          primary: '#16131f',
          secondary: '#1e1a2a',
          accent: '#2fd4e8',
          text: '#f4f2f8',
        },
      },
    },
  },
};
