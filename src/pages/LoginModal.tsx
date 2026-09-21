import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLoginMutation } from '../features/auth/queries';
import { useMigrateLegacyProjectMutation } from '../features/projects/queries';
import { getAuthErrorMessage, getLoginPageCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';
import BrandMark from '../components/BrandMark';
import Modal from '../components/Modal';
import OAuthButtons from '../components/OAuthButtons';

export default function LoginModal() {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const language = lang ?? 'pt';
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const migrateLegacyProject = useMigrateLegacyProjectMutation();
  const copy = getLoginPageCopy(language);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const close = () => navigate(`/${language}`);

  const goToProjects = async () => {
    await migrateLegacyProject.mutateAsync();
    navigate(`/${language}/projects`);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await loginMutation.mutateAsync({ email, password });
    if (result.ok) {
      await goToProjects();
    }
  };

  const error =
    loginMutation.data && !loginMutation.data.ok
      ? loginMutation.data.error
      : null;

  return (
    <Modal onClose={close}>
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col gap-3 rounded-sm border border-line bg-ink-raised p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label={copy.backToHome}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-sm text-chalk-faint hover:bg-ink-raised-2 hover:text-chalk"
        >
          ✕
        </button>

        <div className="mb-1 flex flex-col items-center gap-1.5 text-center">
          <BrandMark className="h-8 w-8" />
          <h1 className="text-base font-semibold text-chalk">{copy.title}</h1>
          <p className="text-xs text-chalk-dim">{copy.subtitle}</p>
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-chalk-dim">
          {copy.emailLabel}
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-chalk outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-chalk-dim">
          {copy.passwordLabel}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-chalk outline-none focus:border-accent"
          />
        </label>

        {error && (
          <p className="text-xs text-signal-down">
            {getAuthErrorMessage(error, language)}
          </p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="btn-planta-solid mt-1 rounded-sm px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
        >
          {loginMutation.isPending ? copy.submitting : copy.submit}
        </button>

        <OAuthButtons language={language} mode="login" copy={copy} onSuccess={goToProjects} />

        <p className="text-center text-xs text-chalk-faint">
          {copy.noAccountText}{' '}
          <button
            type="button"
            onClick={() => navigate(`/${language}/register`)}
            className="font-semibold text-accent hover:underline"
          >
            {copy.registerLinkText}
          </button>
        </p>
      </form>
    </Modal>
  );
}
