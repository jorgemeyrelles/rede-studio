/** Ícone de rede do Rede Studio — usado no header do app e na landing page. */
export default function BrandMark({
  className = 'h-8 w-8',
}: {
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={`flex-shrink-0 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)] ${className}`}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="12" fill="#0f172a" />
      <line x1="32" y1="14" x2="12" y2="38" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="32" y1="14" x2="52" y2="38" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="12" y1="38" x2="32" y2="52" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="52" y1="38" x2="32" y2="52" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="12" y1="38" x2="52" y2="38" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <circle cx="32" cy="14" r="6" fill="#0ea5e9" stroke="#7dd3fc" strokeWidth="1.5" />
      <circle cx="12" cy="38" r="5" fill="#6366f1" stroke="#a5b4fc" strokeWidth="1.5" />
      <circle cx="52" cy="38" r="5" fill="#6366f1" stroke="#a5b4fc" strokeWidth="1.5" />
      <circle cx="32" cy="52" r="4" fill="#10b981" stroke="#6ee7b7" strokeWidth="1.5" />
    </svg>
  );
}
