import { useEffect, type ReactNode } from 'react';

type ModalProps = {
  onClose: () => void;
  children: ReactNode;
};

/**
 * Shell genérico de modal (backdrop + Esc pra fechar + clique fora
 * fecha). Usado por Login/Registro (Fase 4) e reaproveitável pelos
 * modais das próximas fases (Novo Projeto, Configurações).
 */
export default function Modal({ onClose, children }: ModalProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm"
      >
        {children}
      </div>
    </div>
  );
}
