import { useCallback, useEffect, useState } from 'react';
import { PROGRAM_GROUPS, programCatalogVersion, onProgramCatalogChange } from '../data/programs';
import { loadCachedPrograms, refreshPrograms } from '../services/programCatalogService';

let loadedOnce = false;

/**
 * Programs from the admin panel. Shows the phone copy first, then refreshes from the server.
 * status: 'loading' | 'ready' | 'error' (no copy and the server did not answer).
 */
export function usePrograms() {
  const [version, setVersion] = useState(programCatalogVersion());
  const [status, setStatus] = useState(programCatalogVersion() ? 'ready' : 'loading');

  useEffect(() => onProgramCatalogChange(setVersion), []);

  const refresh = useCallback(async () => {
    if (!programCatalogVersion()) setStatus('loading');
    const ok = await refreshPrograms();
    setStatus(ok || programCatalogVersion() ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    (async () => {
      if (!loadedOnce) {
        loadedOnce = true;
        await loadCachedPrograms();
        if (programCatalogVersion()) setStatus('ready');
      }
      refresh();
    })();
  }, [refresh]);

  return { groups: PROGRAM_GROUPS, version, status, refresh };
}
