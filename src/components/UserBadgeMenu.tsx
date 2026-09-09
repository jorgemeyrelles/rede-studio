import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logoutUser } from '../features/auth/authSlice';
import { createProject } from '../features/projects/projectsSlice';
import { getProjectsPageCopy, getUserMenuCopy } from '../i18n/utils';
import type { AppLanguage } from '../types/i18n';
import NewProjectModal from './NewProjectModal';
import SettingsModal from './SettingsModal';

export default function UserBadgeMenu({ language }: { language: AppLanguage }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const projectCount = useAppSelector((state) => state.projects.items.length);
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
    const result = await dispatch(createProject({ name }));
    setCreating(false);
    if (createProject.fulfilled.match(result)) {
      setNewProjectOpen(false);
      navigate(`/${language}/studio/${result.payload.id}`);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={currentUser.name}
        title={currentUser.name}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/50 bg-cyan-500/20 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/30"
      >
        {initial}
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-52 overflow-hidden rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl">
          <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
            {currentUser.name}
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              navigate(`/${language}/projects`);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
          >
            {copy.myProjects}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setNewProjectOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
          >
            {copy.newProject}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
          >
            {copy.settings}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              dispatch(logoutUser());
            }}
            className="block w-full border-t border-slate-800 px-3 py-2 text-left text-xs text-rose-300 hover:bg-slate-800"
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
