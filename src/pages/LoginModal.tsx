import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import BrandMark from '../components/BrandMark';
import Modal from '../components/Modal';
import { clearAuthError, loginUser } from '../features/auth/authSlice';
import { migrateLegacyProject } from '../features/projects/projectsSlice';
import { getAuthErrorMessage, getLoginPageCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';

export default function LoginModal() {
  const { lang } = useParams<{ lang: AppLanguage }>();
  const language = lang ?? 'pt';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { error, status } = useAppSelector((state) => state.auth);
  const copy = getLoginPageCopy(language);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  const close = () => navigate(`/${language}`);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result)) {
      await dispatch(migrateLegacyProject());
      navigate(`/${language}/projects`);
    }
  };

  return (
    <Modal onClose={close}>
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900 p-6"
      >
        <button
          type="button"
          onClick={close}
          aria-label={copy.backToHome}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>

        <div className="mb-2 flex flex-col items-center gap-3 text-center">
          <BrandMark className="h-10 w-10" />
          <h1 className="text-base font-semibold text-white">{copy.title}</h1>
          <p className="text-xs text-slate-400">{copy.subtitle}</p>
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          {copy.emailLabel}
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-600"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          {copy.passwordLabel}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-600"
          />
        </label>

        {error && (
          <p className="text-xs text-red-400">
            {getAuthErrorMessage(error, language)}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="mt-1 rounded-md bg-cyan-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? copy.submitting : copy.submit}
        </button>

        <p className="text-center text-xs text-slate-500">
          {copy.noAccountText}{' '}
          <button
            type="button"
            onClick={() => navigate(`/${language}/register`)}
            className="font-semibold text-cyan-400 hover:underline"
          >
            {copy.registerLinkText}
          </button>
        </p>
      </form>
    </Modal>
  );
}
