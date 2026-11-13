import React, {useCallback, useState} from 'react';
import {useUpdates} from 'expo-updates';
import appUpdate from '../services/AppUpdate';
import {reportError} from '../services/ErrorReporter';
import {shouldOfferRestart} from '../utils/otaUpdate';
import {snackbar} from '../utils/snackbarStore';
import UpdateSheet from './UpdateSheet';

/**
 * Mounted by AuthGate while someone is signed in. The native side downloads an update in the
 * background on every cold start; when one is ready this offers the restart. "Later" hides the
 * sheet for that update until the app is started again (which applies the update anyway).
 */
const UpdatePrompt = () => {
  const {isUpdatePending, downloadedUpdate} = useUpdates();
  const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(
    null,
  );
  const [restarting, setRestarting] = useState(false);
  const downloadedUpdateId = downloadedUpdate?.updateId;

  const handleLater = useCallback(() => {
    setDismissedUpdateId(downloadedUpdateId ?? '');
  }, [downloadedUpdateId]);

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    try {
      await appUpdate.reload();
    } catch (e) {
      // The update is still downloaded, so it applies on the next start of the app.
      reportError(e as Error);
      setRestarting(false);
      setDismissedUpdateId(downloadedUpdateId ?? '');
      snackbar.error(
        'Could not restart. Close and reopen the app to finish the update.',
      );
    }
  }, [downloadedUpdateId]);

  if (!appUpdate.isEnabled) {
    return null;
  }

  return (
    <UpdateSheet
      visible={shouldOfferRestart({
        isUpdatePending,
        downloadedUpdateId,
        dismissedUpdateId,
      })}
      restarting={restarting}
      onRestart={handleRestart}
      onLater={handleLater}
    />
  );
};

export default UpdatePrompt;
