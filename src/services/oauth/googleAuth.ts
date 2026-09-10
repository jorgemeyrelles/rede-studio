type GoogleIdCredentialResponse = {
  credential: string;
};

type GoogleButtonOptions = {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_black' | 'filled_blue';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  shape?: 'rectangular' | 'pill';
  width?: number;
  locale?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleIdCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

type RenderGoogleButtonOptions = {
  container: HTMLElement;
  locale: string;
  text: 'signin_with' | 'signup_with';
  onCredential: (idToken: string) => void;
};

/**
 * Renderiza o botão oficial do Google dentro de `container` e chama
 * `onCredential` com o ID token quando o login é concluído.
 *
 * O botão em si é sempre o componente oficial do Google Identity Services —
 * não dá pra trocar por um botão totalmente customizado nosso de forma
 * confiável (é assim que o GIS garante que o clique veio de um gesto real
 * do usuário). Só o texto (`text`) e o idioma (`locale`) acompanham o
 * idioma atual do app.
 *
 * No-op silencioso se `VITE_GOOGLE_CLIENT_ID` não estiver configurado.
 */
export async function renderGoogleButton({
  container,
  locale,
  text,
  onCredential,
}: RenderGoogleButtonOptions): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return;

  await loadGoogleScript();

  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => onCredential(response.credential),
  });

  container.innerHTML = '';
  window.google!.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    width: 320,
    text,
    locale,
  });
}
