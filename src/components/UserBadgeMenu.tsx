import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, LogOut, Plus, Settings } from 'lucide-react';
import { useLogoutMutation, useSessionQuery } from '../features/auth/queries';
import { flushPendingSave } from '../features/network/useAutosave';
import {
  useCreateProjectMutation,
  useProjectsQuery,
} from '../features/projects/queries';
import type { ProjectNetworkType } from '../features/projects/types';
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
  const [isLoggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  if (!currentUser) return null;

  const initial = currentUser.name.trim().charAt(0).toUpperCase() || '?';

  const handleCreateProject = async (
    name: string,
    networkType: ProjectNetworkType,
  ) => {
    setCreating(true);
    try {
      const record = await createProjectMutation.mutateAsync({
        name,
        networkType,
      });
      setNewProjectOpen(false);
      navigate(`/${language}/studio/${record.id}`);
    } finally {
      setCreating(false);
    }
  };

  // Grava o save pendente do Studio (se houver) ANTES de derrubar a sessão.
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await flushPendingSave();
    } finally {
      setMenuOpen(false);
      setLoggingOut(false);
      logoutMutation.mutate();
    }
  };

  const itemClass =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-chalk-dim transition-colors hover:bg-ink-raised-2 hover:text-chalk focus-visible:bg-ink-raised-2 focus-visible:text-chalk focus-visible:-outline-offset-2';

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={currentUser.name}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        title={currentUser.name}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-xs font-bold text-accent transition-colors hover:bg-accent/25"
      >
        {initial}
      </button>

      {isMenuOpen && (
        <div
          role="menu"
          aria-label={currentUser.name}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled)',
              ),
            );
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const step = event.key === 'ArrowDown' ? 1 : -1;
            items[(index + step + items.length) % items.length]?.focus();
          }}
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-md border border-line bg-ink-raised py-1 shadow-panel"
        >
          <div className="truncate border-b border-line px-3 py-2 text-xs text-chalk-faint">
            {currentUser.name}
          </div>
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setMenuOpen(false);
              navigate(`/${language}/projects`);
            }}
            className={itemClass}
          >
            <FolderOpen size={15} aria-hidden="true" />
            {copy.myProjects}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setNewProjectOpen(true);
            }}
            className={itemClass}
          >
            <Plus size={15} aria-hidden="true" />
            {copy.newProject}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
            className={itemClass}
          >
            <Settings size={15} aria-hidden="true" />
            {copy.settings}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            className={`${itemClass} border-t border-line hover:text-signal-down disabled:cursor-wait`}
          >
            <LogOut size={15} aria-hidden="true" />
            {isLoggingOut ? copy.loggingOut : copy.logout}
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
