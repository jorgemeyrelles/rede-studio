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
    <Modal
      onClose={close}
      title={copy.title}
      closeLabel={copy.backToHome}
      leading={<BrandMark className="h-9 w-9" />}
      centered
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="-mt-3 text-center text-sm text-chalk-dim">
          {copy.subtitle}
        </p>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.emailLabel}
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.passwordLabel}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>

        {error && (
          <p role="alert" className="text-xs text-signal-down">
            {getAuthErrorMessage(error, language)}
          </p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="btn btn-primary btn-md mt-1 h-10 w-full"
        >
          {loginMutation.isPending ? copy.submitting : copy.submit}
        </button>

        <OAuthButtons
          language={language}
          mode="login"
          copy={copy}
          onSuccess={goToProjects}
        />

        <p className="text-center text-xs text-chalk-dim">
          {copy.noAccountText}{' '}
          <button
            type="button"
            onClick={() => navigate(`/${language}/register`)}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {copy.registerLinkText}
          </button>
        </p>
      </form>
    </Modal>
  );
}
