/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      // Tokens do redesign "Planta" (ver .claude/plans/redesign-planta-e-sessao-jwt.md).
      // Todos resolvem pra custom properties definidas em src/styles/global.css — o
      // valor real fica num só lugar (a variante de acento troca lá, não aqui).
      colors: {
        // `ink`/`accent` usam a forma "canais RGB + <alpha-value>" pra
        // suportar modificador de opacidade do Tailwind (`bg-ink/95`,
        // `border-accent/50`) — únicos dois tokens usados assim neste
        // redesign. Os demais resolvem pro hex direto (ver global.css).
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        'ink-raised': 'var(--ink-raised)',
        'ink-raised-2': 'var(--ink-raised-2)',
        line: 'var(--line)',
        chalk: 'var(--chalk)',
        'chalk-dim': 'var(--chalk-dim)',
        'chalk-faint': 'var(--chalk-faint)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-2': 'var(--accent-2)',
        'accent-ink': 'var(--accent-ink)',
        'accent-print': 'var(--accent-print)',
        'signal-up': 'rgb(var(--signal-up-rgb) / <alpha-value>)',
        'signal-down': 'rgb(var(--signal-down-rgb) / <alpha-value>)',
        'signal-warn': 'rgb(var(--signal-warn-rgb) / <alpha-value>)',
        'route-direct': 'var(--route-direct)',
        'route-static': 'var(--route-static)',
        'route-default': 'var(--route-default)',
        'route-vpn': 'var(--route-vpn)',
        'route-bgp': 'var(--route-bgp)',
        paper: 'var(--paper)',
        'paper-ink': 'var(--paper-ink)',
        'paper-line': 'var(--paper-line)',
        'paper-dim': 'var(--paper-dim)',
      },
      fontFamily: {
        display: ['Archivo', 'Arial Black', 'sans-serif'],
        sans: ['Public Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
