import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRegisterMutation } from '../features/auth/queries';
import { useMigrateLegacyProjectMutation } from '../features/projects/queries';
import { getAuthErrorMessage, getRegisterPageCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';
import BrandMark from '../components/BrandMark';
import Modal from '../components/Modal';
import OAuthButtons from '../components/OAuthButtons';

export default function RegisterModal() {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const language = lang ?? 'pt';
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();
  const migrateLegacyProject = useMigrateLegacyProjectMutation();
  const copy = getRegisterPageCopy(language);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const close = () => navigate(`/${language}`);

  const goToProjects = async () => {
    await migrateLegacyProject.mutateAsync();
    navigate(`/${language}/projects`);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);

    const result = await registerMutation.mutateAsync({
      name,
      email,
      password,
    });
    if (result.ok) {
      await goToProjects();
    }
  };

  const error =
    registerMutation.data && !registerMutation.data.ok
      ? registerMutation.data.error
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
          {copy.nameLabel}
          <input
            type="text"
            required
            autoFocus
            autoComplete="name"
            minLength={3}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.emailLabel}
          <input
            type="email"
            required
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.confirmPasswordLabel}
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field"
          />
        </label>

        {mismatch && (
          <p role="alert" className="text-xs text-signal-down">
            {copy.passwordMismatch}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-signal-down">
            {getAuthErrorMessage(error, language)}
          </p>
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="btn btn-primary btn-md mt-1 h-10 w-full"
        >
          {registerMutation.isPending ? copy.submitting : copy.submit}
        </button>

        <OAuthButtons
          language={language}
          mode="register"
          copy={copy}
          onSuccess={goToProjects}
        />

        <p className="text-center text-xs text-chalk-dim">
          {copy.hasAccountText}{' '}
          <button
            type="button"
            onClick={() => navigate(`/${language}/login`)}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {copy.loginLinkText}
          </button>
        </p>
      </form>
    </Modal>
  );
}
