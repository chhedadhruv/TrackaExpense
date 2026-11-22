import {useCallback} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useUid} from '../data/hooks';
import {queryKeys} from '../data/keys';
import {reportError} from '../services/ErrorReporter';
import {loadUserTags, recordTagUse} from '../services/TagService';
import {logTagAdded} from '../services/AnalyticsService';
import {unknownTags, withRecentTags} from '../utils/tags';

const FIVE_MINUTES = 1000 * 60 * 5;

// A stable empty list, so a form that has no suggestions yet does not re-render on every pass.
const NO_TAGS: string[] = [];

/**
 * The user's earlier tags, most recent first, for the suggestions under the tag field. They live
 * in the query cache (saved to the phone, so a cold start offers them at once, also offline) and
 * are read again when they are older than five minutes and a form opens. Suggestions are a
 * convenience, so a failed load is reported and the form simply offers none; it never blocks
 * saving.
 */
export function useKnownTags(): string[] {
  const uid = useUid();
  const {data} = useQuery<string[]>({
    queryKey: queryKeys.tags(uid),
    enabled: uid !== '',
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      try {
        return await loadUserTags(uid);
      } catch (error) {
        reportError(error as Error);
        throw error;
      }
    },
  });
  return data ?? NO_TAGS;
}

/**
 * Records the tags a saved transaction used: writes the user's tag list, then moves those tags to
 * the front of the cached suggestions so the next form shows them without another read. The
 * returned promise rejects if the write fails; callers report it and carry on.
 */
export function useRecordTags(): (
  selected: readonly string[],
  known: readonly string[],
) => Promise<void> {
  const uid = useUid();
  const queryClient = useQueryClient();
  return useCallback(
    async (selected, known) => {
      await recordTagUse(uid, selected, known);
      // One event per tag the person has not used before.
      unknownTags(selected, known).forEach(() => logTagAdded());
      if (selected.length > 0) {
        queryClient.setQueryData<string[]>(queryKeys.tags(uid), old =>
          withRecentTags(old ?? known, selected),
        );
      }
    },
    [uid, queryClient],
  );
}
