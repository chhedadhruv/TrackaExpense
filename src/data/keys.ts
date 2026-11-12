/**
 * Query keys for the cached data. Every key starts with the user's id so one person's data can
 * never be shown to another, and the first part names the kind of data (the cache saves only the
 * kinds listed in queryClient.ts).
 */
export const queryKeys = {
  user: (uid: string) => ['user', uid] as const,
  transactions: (uid: string) => ['transactions', uid] as const,
  savingsHistory: (uid: string) => ['savingsHistory', uid] as const,
};
