import { useEffect, useRef, useState } from 'react';
import { useOAuthLoginMutation } from '../features/auth/queries';
import { getAuthErrorMessage } from '../i18n/utils';
import { renderGoogleButton } from '../services/oauth/googleAuth';
import { signInWithMicrosoft } from '../services/oauth/microsoftAuth';
import type { AppLanguage } from '../types/i18n';

type OAuthButtonsCopy = {
  orDivider: string;
  continueWithMicrosoft: string;
};

type OAuthButtonsProps = {
  language: AppLanguage;
  mode: 'login' | 'register';
  copy: OAuthButtonsCopy;
  onSuccess: () => void | Promise<void>;
};

/**
 * Botões "Continuar com Google/Microsoft" compartilhados entre Login e
 * Registro — os dois fazem exatamente a mesma coisa depois do ID token
 * (despachar `loginWithOAuthProvider` e rodar o mesmo `onSuccess`), só o
 * texto do botão do Google muda (signin_with vs signup_with).
 */
export default function OAuthButtons({
  language,
  mode,
  copy,
  onSuccess,
}: OAuthButtonsProps) {
  const oauthLoginMutation = useOAuthLoginMutation();
  const googleContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  useEffect(() => {
    const container = googleContainerRef.current;
    if (!container) return;

    renderGoogleButton({
      container,
      locale: language,
      text: mode === 'login' ? 'signin_with' : 'signup_with',
      onCredential: async (idToken) => {
        setError(null);
        const result = await oauthLoginMutation.mutateAsync({
          provider: 'google',
          idToken,
        });
        if (result.ok) {
          await onSuccess();
        } else {
          setError(getAuthErrorMessage(result.error, language));
        }
      },
    });
  }, [language, mode, oauthLoginMutation, onSuccess]);

  const handleMicrosoft = async () => {
    setError(null);
    setMicrosoftLoading(true);
    try {
      const idToken = await signInWithMicrosoft();
      const result = await oauthLoginMutation.mutateAsync({
        provider: 'microsoft',
        idToken,
      });
      if (result.ok) {
        await onSuccess();
      } else {
        setError(getAuthErrorMessage(result.error, language));
      }
    } catch {
      setError(getAuthErrorMessage('OAUTH_FAILED', language));
    } finally {
      setMicrosoftLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-chalk-faint">
        <span className="h-px flex-1 bg-line" />
        {copy.orDivider}
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Os dois botões ocupam a largura da coluna do formulário, como os
          inputs. O do Google é o componente oficial do GIS (retangular,
          largura = largura deste container — ver googleAuth.ts); o da
          Microsoft segue a mesma altura (40px) e o raio do sistema. */}
      <div className="flex w-full flex-col gap-2">
        <div
          ref={googleContainerRef}
          className="flex min-h-10 w-full justify-center"
        />

        <button
          type="button"
          onClick={handleMicrosoft}
          disabled={microsoftLoading}
          className="btn h-10 w-full border border-line bg-ink px-4 text-sm font-medium text-chalk enabled:hover:border-chalk-faint enabled:hover:bg-ink-raised-2"
        >
          <MicrosoftLogo />
          {copy.continueWithMicrosoft}
        </button>
      </div>

      {error && <p className="text-center text-xs text-signal-down">{error}</p>}
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 21 21"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
