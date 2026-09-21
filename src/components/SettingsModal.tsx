import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { replaceLangSegment } from '../app/routing/replaceLangSegment';
import { useSessionQuery, useUpdateProfileMutation } from '../features/auth/queries';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { data: currentUser } = useSessionQuery();
  const updateProfileMutation = useUpdateProfileMutation();
  const copy = getSettingsModalCopy(language);

  const [name, setName] = useState(currentUser?.name ?? '');
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(
    currentUser?.preferredLanguage ?? language,
  );
  const [justSaved, setJustSaved] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await updateProfileMutation.mutateAsync({
      name,
      preferredLanguage: selectedLanguage,
    });
    if (result.ok) {
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
        className="relative flex w-full flex-col gap-4 rounded-sm border border-line bg-ink-raised p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.cancelButton}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-sm text-chalk-faint hover:bg-ink-raised-2 hover:text-chalk"
        >
          ✕
        </button>

        <div className="mb-1 flex items-center gap-3">
          <BrandMark className="h-8 w-8" />
          <h2 className="text-sm font-semibold text-chalk">{copy.title}</h2>
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-chalk-dim">
          {copy.nameLabel}
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-chalk outline-none focus:border-accent"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-xs text-chalk-dim">
          {copy.languageLabel}
          <div className="flex gap-1.5">
            {STUDIO_LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedLanguage(option.value)}
                title={option.label}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition ${
                  selectedLanguage === option.value
                    ? 'bg-accent text-accent-ink'
                    : 'bg-ink-raised-2 text-chalk-dim hover:bg-ink-raised'
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

        <p className="text-[11px] text-chalk-faint">{copy.passwordNote}</p>

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wider text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="btn-planta-solid rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            {updateProfileMutation.isPending
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
