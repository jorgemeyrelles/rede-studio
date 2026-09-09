import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  onClose: () => void;
  children: ReactNode;
};

/**
 * Shell genérico de modal (backdrop + Esc pra fechar + clique fora
 * fecha). Usado por Login/Registro, Novo Projeto e Configurações.
 *
 * Renderiza via portal em document.body: um ancestral com backdrop-blur/
 * transform (ex.: o header do AppShellLayout) cria um novo containing
 * block para `position: fixed`, o que descentralizava o modal quando
 * aberto a partir do menu do usuário. O portal escapa desse problema
 * independentemente de onde o modal é montado na árvore.
 */
export default function Modal({ onClose, children }: ModalProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
