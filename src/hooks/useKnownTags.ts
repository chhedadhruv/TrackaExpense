import {useEffect, useState} from 'react';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../services/ErrorReporter';
import {loadUserTags} from '../services/TagService';

/**
 * The user's earlier tags, most recent first, for the suggestions under the tag field. Loaded once
 * when the form opens. Suggestions are a convenience, so a failed load is reported and the form
 * simply offers none; it never blocks saving.
 */
export function useKnownTags(): string[] {
  const [knownTags, setKnownTags] = useState<string[]>([]);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      return;
    }
    let cancelled = false;
    loadUserTags(uid)
      .then(tags => {
        if (!cancelled) {
          setKnownTags(tags);
        }
      })
      .catch(reportError);
    return () => {
      cancelled = true;
    };
  }, []);

  return knownTags;
}
