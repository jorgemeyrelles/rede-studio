type SaveStatusButtonProps = {
  saveStatus: 'idle' | 'saving' | 'saved';
  persistWarning: string | null;
  lastSavedAt: string | null;
  language: string;
  copy: { warning: string; saving: string; saved: string; notSavedYet: string };
  /** Força o save imediato. */
  onClick: () => void;
};

/**
 * "Medidor de sinal" do autosave — 3 estados (persistWarning/saving/idle)
 * em barras coloridas pelos tokens de sinal. Clicar força o save imediato.
 * O anúncio pra leitor de tela fica no <span> sr-only, não no botão.
 * Compartilhado pelos Studios on-prem e cloud.
 */
export default function SaveStatusButton({
  saveStatus,
  persistWarning,
  lastSavedAt,
  language,
  copy,
  onClick,
}: SaveStatusButtonProps) {
  const label = persistWarning
    ? copy.warning
    : saveStatus === 'saving'
      ? copy.saving
      : lastSavedAt
        ? `${copy.saved} ${new Date(lastSavedAt).toLocaleTimeString(language, {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : copy.notSavedYet;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title={lastSavedAt ? new Date(lastSavedAt).toLocaleString(language) : copy.notSavedYet}
        className={`btn btn-sm border border-line font-medium tabular-nums enabled:hover:bg-ink-raised-2 ${
          persistWarning
            ? 'text-signal-warn'
            : saveStatus === 'saving'
              ? 'text-accent'
              : 'text-signal-up'
        }`}
      >
        <span className="flex h-[11px] items-end gap-[2px]" aria-hidden="true">
          {[4, 8, 11, 6].map((height, index) => (
            <span
              key={index}
              className={`w-[2px] ${saveStatus === 'saving' ? 'animate-pulse' : ''}`}
              style={{ height, backgroundColor: 'currentColor' }}
            />
          ))}
        </span>
        {label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {saveStatus === 'saving' || persistWarning ? label : ''}
      </span>
    </>
  );
}
