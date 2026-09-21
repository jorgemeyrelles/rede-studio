import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogoutMutation, useSessionQuery } from '../features/auth/queries';
import {
    useCreateProjectMutation,
    useProjectsQuery,
} from '../features/projects/queries';
import { getProjectsPageCopy, getUserMenuCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';
import NewProjectModal from './NewProjectModal';
import SettingsModal from './SettingsModal';

export default function UserBadgeMenu({ language }: { language: AppLanguage }) {
  const navigate = useNavigate();
  const { data: currentUser } = useSessionQuery();
  const logoutMutation = useLogoutMutation();
  const { data: projects } = useProjectsQuery(currentUser?.id);
  const createProjectMutation = useCreateProjectMutation();
  const projectCount = projects?.length ?? 0;
  const copy = getUserMenuCopy(language);
  const projectsCopy = getProjectsPageCopy(language);

  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isNewProjectOpen, setNewProjectOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isCreating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  if (!currentUser) return null;

  const initial = currentUser.name.trim().charAt(0).toUpperCase() || '?';

  const handleCreateProject = async (name: string) => {
    setCreating(true);
    try {
      const record = await createProjectMutation.mutateAsync({ name });
      setNewProjectOpen(false);
      navigate(`/${language}/studio/${record.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={currentUser.name}
        title={currentUser.name}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/50 bg-accent/20 text-xs font-bold text-accent transition hover:bg-accent/30"
      >
        {initial}
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-52 overflow-hidden rounded-sm border border-line bg-ink-raised py-1 shadow-xl">
          <div className="border-b border-line px-3 py-2 text-xs text-chalk-dim">
            {currentUser.name}
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              navigate(`/${language}/projects`);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk"
          >
            {copy.myProjects}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setNewProjectOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk"
          >
            {copy.newProject}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-chalk-dim hover:bg-ink-raised-2 hover:text-chalk"
          >
            {copy.settings}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              logoutMutation.mutate();
            }}
            className="block w-full border-t border-line px-3 py-2 text-left text-xs text-signal-down hover:bg-ink-raised-2"
          >
            {copy.logout}
          </button>
        </div>
      )}

      {isNewProjectOpen && (
        <NewProjectModal
          onClose={() => setNewProjectOpen(false)}
          onCreate={handleCreateProject}
          defaultName={`${projectsCopy.defaultProjectNamePrefix} ${projectCount + 1}`}
          isCreating={isCreating}
          copy={projectsCopy}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          language={language}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
