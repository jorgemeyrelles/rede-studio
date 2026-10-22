import { useSaveProjectSnapshotMutation } from '../projects/queries';
import { useProjectAutosave } from '../autosave/useProjectAutosave';
import { markSaved, setPersistWarning, setSaveStatus } from './networkSlice';

// O flush é único para os dois Studios (só um fica aberto por vez) — mantido
// exportado daqui porque é o caminho que o logout (`UserBadgeMenu`) já usa.
export { flushPendingSave } from '../autosave/useProjectAutosave';

/**
 * Autosave do Studio on-prem: `useProjectAutosave` (debounce, flush e troca
 * de projeto documentados lá) sobre `state.network`, gravando via
 * `useSaveProjectSnapshotMutation` (`PUT /api/projects/{id}/snapshot`).
 */
export function useAutosave() {
  const saveMutation = useSaveProjectSnapshotMutation();
  return useProjectAutosave({
    selectState: (root) => root.network,
    save: (id, networkState) => saveMutation.mutateAsync({ id, networkState }),
    markSaved,
    setPersistWarning,
    setSavingStatus: () => setSaveStatus('saving'),
  });
}
