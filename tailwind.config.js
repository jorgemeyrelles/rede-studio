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
        'line-strong': 'var(--line-strong)',
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
        'route-direct': 'rgb(var(--route-direct-rgb) / <alpha-value>)',
        'route-static': 'rgb(var(--route-static-rgb) / <alpha-value>)',
        'route-default': 'rgb(var(--route-default-rgb) / <alpha-value>)',
        'route-vpn': 'rgb(var(--route-vpn-rgb) / <alpha-value>)',
        'route-bgp': 'rgb(var(--route-bgp-rgb) / <alpha-value>)',
        'tier-edge': 'rgb(var(--tier-edge-rgb) / <alpha-value>)',
        'tier-distribution':
          'rgb(var(--tier-distribution-rgb) / <alpha-value>)',
        'tier-access': 'rgb(var(--tier-access-rgb) / <alpha-value>)',
        'tier-server': 'rgb(var(--tier-server-rgb) / <alpha-value>)',
        'tier-endpoint': 'rgb(var(--tier-endpoint-rgb) / <alpha-value>)',
        'tier-dmz': 'rgb(var(--tier-dmz-rgb) / <alpha-value>)',
        'tier-management': 'rgb(var(--tier-management-rgb) / <alpha-value>)',
        'tier-custom': 'rgb(var(--tier-custom-rgb) / <alpha-value>)',
        'aws-account': 'rgb(var(--aws-account-rgb) / <alpha-value>)',
        'aws-region': 'rgb(var(--aws-region-rgb) / <alpha-value>)',
        'aws-vpc': 'rgb(var(--aws-vpc-rgb) / <alpha-value>)',
        'aws-az': 'rgb(var(--aws-az-rgb) / <alpha-value>)',
        'aws-subnet-public': 'rgb(var(--aws-subnet-public-rgb) / <alpha-value>)',
        'aws-subnet-private':
          'rgb(var(--aws-subnet-private-rgb) / <alpha-value>)',
        'aws-asg': 'rgb(var(--aws-asg-rgb) / <alpha-value>)',
        'aws-cloud': 'rgb(var(--aws-cloud-rgb) / <alpha-value>)',
        paper: 'var(--paper)',
        'paper-ink': 'var(--paper-ink)',
        'paper-line': 'var(--paper-line)',
        'paper-dim': 'var(--paper-dim)',
      },
      // Escala tipográfica (ver .claude/plans/critique-p0-p1-e-polish.md, 4.2).
      // `text-sm` (14) = body e `text-xs` (12) = small seguem do Tailwind;
      // `2xs` (11) é o piso — nada abaixo disso no app.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        heading: ['0.9375rem', { lineHeight: '1.4' }],
        title: ['1.25rem', { lineHeight: '1.3' }],
        display: [
          'clamp(2rem, 1.2rem + 3.6vw, 3.25rem)',
          { lineHeight: '1.05', letterSpacing: '-0.02em' },
        ],
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        overlay: 'var(--shadow-overlay)',
      },
      fontFamily: {
        display: ['Archivo', 'Arial Black', 'sans-serif'],
        sans: [
          'Public Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
