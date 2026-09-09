type ClarityFn = {
  (...args: unknown[]): void;
  q?: unknown[][];
};

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/**
 * Injeta o snippet oficial do Microsoft Clarity (https://clarity.microsoft.com)
 * e só roda em produção com VITE_CLARITY_PROJECT_ID configurado — sem a env
 * var, ou em dev, é um no-op silencioso (sem poluir os dados com sessões
 * locais).
 */
export function initClarity(): void {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (!projectId || !import.meta.env.PROD || window.clarity) return;

  const clarityFn: ClarityFn = (...args) => {
    (clarityFn.q = clarityFn.q || []).push(args);
  };
  window.clarity = clarityFn;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  document.head.appendChild(script);
}

/** Correlaciona gravações de sessão do Clarity com o usuário autenticado. */
export function identifyClarityUser(email: string): void {
  window.clarity?.('identify', email);
}
