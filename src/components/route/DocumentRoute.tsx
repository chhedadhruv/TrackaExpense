import React from 'react';
import {EmptyState, ErrorState, LoadingState} from '../ScreenState';
import {useDocument} from '../../hooks/useDocument';

interface DocumentRouteProps<T extends object> {
  /** Firestore path segments, or null while an id is still missing. */
  segments: readonly string[] | null;
  /** Shown when the document does not exist (deleted, or a stale link). */
  missingTitle: string;
  render: (data: T) => React.ReactElement;
}

/**
 * The route-level wrapper for a screen opened by id: it reads the document, shows the loading,
 * not-found and error states, and hands the document to `render` once it is there.
 */
const DocumentRoute = <T extends object>({
  segments,
  missingTitle,
  render,
}: DocumentRouteProps<T>) => {
  const {state, reload} = useDocument<T>(segments);

  if (state.status === 'loading') {
    return <LoadingState message="Loading…" />;
  }
  if (state.status === 'error') {
    return <ErrorState onRetry={reload} />;
  }
  if (state.status === 'missing') {
    return (
      <EmptyState
        fill
        title={missingTitle}
        message="It may have been deleted."
      />
    );
  }
  return render(state.data);
};

export default DocumentRoute;
