/**
 * Ícone de rede do Rede Studio — usado no header do app e na landing page.
 * Logo "Nó & Malha" (01) do redesign Planta — ver
 * .claude/plans/redesign-planta-e-sessao-jwt.md. Cores vêm dos tokens
 * definidos em src/styles/global.css (var(--accent)/var(--accent-2)), não de
 * hex fixos, pra acompanhar qualquer troca de variante de paleta.
 */
export default function BrandMark({
  className = 'h-8 w-8',
}: {
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="9" fill="var(--ink)" />
      <line x1="24" y1="9" x2="24" y2="25" stroke="var(--accent)" strokeWidth="2.2" />
      <line x1="24" y1="25" x2="10" y2="37" stroke="var(--accent)" strokeWidth="2.2" />
      <line x1="24" y1="25" x2="38" y2="37" stroke="var(--accent)" strokeWidth="2.2" />
      <line x1="10" y1="37" x2="38" y2="37" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="24" cy="9" r="4" fill="var(--ink-raised)" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="24" cy="25" r="5" fill="var(--accent)" />
      <circle cx="10" cy="37" r="3.4" fill="var(--ink-raised)" stroke="var(--accent-2)" strokeWidth="2" />
      <circle cx="38" cy="37" r="3.4" fill="var(--ink-raised)" stroke="var(--accent-2)" strokeWidth="2" />
    </svg>
  );
}
