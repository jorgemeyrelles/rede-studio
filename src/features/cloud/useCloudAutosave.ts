import { useSaveCloudSnapshotMutation } from '../projects/queries';
import { useProjectAutosave } from '../autosave/useProjectAutosave';
import {
  markCloudSaved,
  setCloudPersistWarning,
  setCloudSaveStatus,
} from './cloudSlice';

/**
 * Autosave do Studio Cloud: mesma regra do on-prem (`useProjectAutosave`)
 * sobre `state.cloud`, gravando via `PUT /api/projects/{id}/cloud-snapshot`.
 */
export function useCloudAutosave() {
  const saveMutation = useSaveCloudSnapshotMutation();
  return useProjectAutosave({
    selectState: (root) => root.cloud,
    save: (id, cloudState) => saveMutation.mutateAsync({ id, cloudState }),
    markSaved: markCloudSaved,
    setPersistWarning: setCloudPersistWarning,
    setSavingStatus: () => setCloudSaveStatus('saving'),
  });
}
