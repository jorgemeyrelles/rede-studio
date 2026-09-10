import { useEffect, useRef, useState } from 'react';
import { useAppDispatch } from '../app/hooks';
import { loginWithOAuthProvider } from '../features/auth/authSlice';
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
export default function OAuthButtons({ language, mode, copy, onSuccess }: OAuthButtonsProps) {
  const dispatch = useAppDispatch();
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
        const result = await dispatch(loginWithOAuthProvider({ provider: 'google', idToken }));
        if (loginWithOAuthProvider.fulfilled.match(result)) {
          await onSuccess();
        } else {
          setError(getAuthErrorMessage(result.payload ?? 'OAUTH_FAILED', language));
        }
      },
    });
  }, [language, mode, dispatch, onSuccess]);

  const handleMicrosoft = async () => {
    setError(null);
    setMicrosoftLoading(true);
    try {
      const idToken = await signInWithMicrosoft();
      const result = await dispatch(loginWithOAuthProvider({ provider: 'microsoft', idToken }));
      if (loginWithOAuthProvider.fulfilled.match(result)) {
        await onSuccess();
      } else {
        setError(getAuthErrorMessage(result.payload ?? 'OAUTH_FAILED', language));
      }
    } catch {
      setError(getAuthErrorMessage('OAUTH_FAILED', language));
    } finally {
      setMicrosoftLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
        <span className="h-px flex-1 bg-slate-800" />
        {copy.orDivider}
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      {/* Largura fixa em 320px pros dois botões ficarem com o mesmo formato
          — o botão do Google é renderizado pelo próprio Google com
          width: 320 (ver googleAuth.ts), então o da Microsoft segue igual. */}
      <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2">
        <div ref={googleContainerRef} />

        <button
          type="button"
          onClick={handleMicrosoft}
          disabled={microsoftLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MicrosoftLogo />
          {copy.continueWithMicrosoft}
        </button>
      </div>

      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
