import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  onClose: () => void;
  /** Título do diálogo — vira o `aria-labelledby`. */
  title: ReactNode;
  /** Nome acessível do botão de fechar (localizado pelo chamador). */
  closeLabel: string;
  children: ReactNode;
  /** Conteúdo acima do título (ex.: BrandMark nos modais de auth). */
  leading?: ReactNode;
  /** Alinha o cabeçalho ao centro (auth) em vez de à esquerda. */
  centered?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /**
   * `false` enquanto uma operação não pode ser interrompida (ex.: gerando
   * PDF): Esc, clique fora e o botão de fechar ficam inativos.
   */
  dismissible?: boolean;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal compartilhado de todo o app (auth, novo projeto, settings,
 * excluir projeto, apagar conteúdo, imprimir PDF).
 *
 * - `role="dialog"` + `aria-modal` + `aria-labelledby` no título.
 * - Esc e clique fora fecham (salvo `dismissible={false}`).
 * - Foco: vai pro primeiro elemento com `autoFocus` (ou o painel), fica
 *   preso dentro do diálogo no Tab e volta pro gatilho ao fechar.
 * - Renderiza via portal em document.body: um ancestral com transform/
 *   filter (ex.: header do AppShellLayout) cria um containing block novo
 *   pra `position: fixed` e descentralizaria o modal.
 */
export default function Modal({
  onClose,
  title,
  closeLabel,
  children,
  leading,
  centered = false,
  size = 'sm',
  dismissible = true,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4 backdrop-blur-sm"
      onClick={() => dismissible && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-md border border-line bg-ink-raised p-6 shadow-overlay outline-none ${
          size === 'lg' ? 'max-w-2xl' : size === 'md' ? 'max-w-md' : 'max-w-sm'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={!dismissible}
          aria-label={closeLabel}
          title={closeLabel}
          className="btn btn-ghost btn-sm btn-icon absolute right-3 top-3"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <header
          className={`mb-5 flex gap-3 pr-8 ${
            centered ? 'flex-col items-center pl-8 text-center' : 'items-center'
          }`}
        >
          {leading}
          <h2
            id={titleId}
            className="font-display text-title font-bold text-chalk"
          >
            {title}
          </h2>
        </header>

        {children}
      </div>
    </div>,
    document.body,
  );
}
