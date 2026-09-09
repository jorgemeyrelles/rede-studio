import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { replaceLangSegment } from '../app/routing/replaceLangSegment';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { updateUserProfile } from '../features/auth/authSlice';
import { getSettingsModalCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';
import BrandMark from './BrandMark';
import Modal from './Modal';
import { STUDIO_LANGUAGE_OPTIONS } from './studio/catalog';

type SettingsModalProps = {
  language: AppLanguage;
  onClose: () => void;
};

export default function SettingsModal({ language, onClose }: SettingsModalProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const status = useAppSelector((state) => state.auth.status);
  const copy = getSettingsModalCopy(language);

  const [name, setName] = useState(currentUser?.name ?? '');
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(
    currentUser?.preferredLanguage ?? language,
  );
  const [justSaved, setJustSaved] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await dispatch(
      updateUserProfile({ name, preferredLanguage: selectedLanguage }),
    );
    if (updateUserProfile.fulfilled.match(result)) {
      setJustSaved(true);
      if (selectedLanguage !== language) {
        navigate(replaceLangSegment(location.pathname, selectedLanguage));
      }
      setTimeout(() => {
        setJustSaved(false);
        onClose();
      }, 900);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900 p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.cancelButton}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>

        <div className="mb-1 flex items-center gap-3">
          <BrandMark className="h-8 w-8" />
          <h2 className="text-sm font-semibold text-white">{copy.title}</h2>
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-slate-400">
          {copy.nameLabel}
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-600"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-xs text-slate-400">
          {copy.languageLabel}
          <div className="flex gap-1.5">
            {STUDIO_LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedLanguage(option.value)}
                title={option.label}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition ${
                  selectedLanguage === option.value
                    ? 'bg-cyan-400/90 text-slate-950'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <img
                  src={option.flagSrc}
                  width={18}
                  height={13}
                  alt={option.label}
                  className="rounded-[1px] object-cover"
                />
                {option.flag}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">{copy.passwordNote}</p>

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-800"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'loading'
              ? copy.saving
              : justSaved
                ? copy.savedConfirmation
                : copy.saveButton}
          </button>
        </div>
      </form>
    </Modal>
  );
}
