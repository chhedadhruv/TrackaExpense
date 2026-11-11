/**
 * Whether a third-party reporting service (Sentry, Mixpanel) should start.
 *
 * It starts only in a release build and only when its key is set. Development builds (Metro,
 * `__DEV__` true) never send events, so local testing does not pollute the production dashboards
 * or use up the event quota. Release builds, including EAS preview and production, are unaffected.
 */
export const isServiceEnabled = (
  key: string | null | undefined,
  isDev: boolean,
): boolean => !isDev && typeof key === 'string' && key.trim().length > 0;
