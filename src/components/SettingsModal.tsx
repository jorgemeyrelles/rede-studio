import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { replaceLangSegment } from '../app/routing/replaceLangSegment';
import {
  useSessionQuery,
  useUpdateProfileMutation,
} from '../features/auth/queries';
import { getSettingsModalCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';
import BrandMark from './BrandMark';
import Modal from './Modal';
import { STUDIO_LANGUAGE_OPTIONS } from './studio/catalog';

type SettingsModalProps = {
  language: AppLanguage;
  onClose: () => void;
};

export default function SettingsModal({
  language,
  onClose,
}: SettingsModalProps) {
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
    <Modal
      onClose={onClose}
      title={copy.title}
      closeLabel={copy.cancelButton}
      leading={<BrandMark className="h-8 w-8" />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-chalk-dim">
          {copy.nameLabel}
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
            {copy.languageLabel}
          </legend>
          <div role="radiogroup" className="flex gap-2">
            {STUDIO_LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selectedLanguage === option.value}
                onClick={() => setSelectedLanguage(option.value)}
                title={option.label}
                className={`flex h-9 items-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors ${
                  selectedLanguage === option.value
                    ? 'border-accent bg-accent/10 text-chalk'
                    : 'border-line text-chalk-dim hover:border-chalk-faint hover:text-chalk'
                }`}
              >
                <img
                  src={option.flagSrc}
                  width={18}
                  height={13}
                  alt=""
                  className="rounded-[1px] object-cover"
                />
                {option.flag}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="text-xs text-chalk-faint">{copy.passwordNote}</p>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            {copy.cancelButton}
          </button>
          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            aria-busy={updateProfileMutation.isPending}
            className="btn btn-primary btn-md"
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
