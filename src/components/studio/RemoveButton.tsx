import { X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { AppLanguage } from '../../types/i18n';
import { getServicesCertificatesCopy } from './utils/i18n';

/**
 * Botão só-ícone de remover item (linha de tabela, política, fila...).
 * Nome acessível localizado pelo idioma da rota quando `label` não vem.
 */
export default function RemoveButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const name = label ?? getServicesCertificatesCopy(lang ?? 'pt').remove;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={name}
      title={name}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-chalk-faint transition-colors hover:bg-signal-down/15 hover:text-signal-down disabled:cursor-not-allowed disabled:opacity-40"
    >
      <X size={13} aria-hidden="true" />
    </button>
  );
}
