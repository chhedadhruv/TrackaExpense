/**
 * Query keys for the cached data. Every key starts with the user's id so one person's data can
 * never be shown to another, and the first part names the kind of data (the cache saves only the
 * kinds listed in queryClient.ts).
 */
export const queryKeys = {
  user: (uid: string) => ['user', uid] as const,
  transactions: (uid: string) => ['transactions', uid] as const,
  savingsHistory: (uid: string) => ['savingsHistory', uid] as const,
  groups: (uid: string) => ['groups', uid] as const,
  invitations: (uid: string) => ['invitations', uid] as const,
  memberDetails: (emails: string) => ['memberDetails', emails] as const,
  groupSplits: (uid: string, groupId: string) =>
    ['groupSplits', uid, groupId] as const,
  splitHistory: (uid: string, groupIds: string) =>
    ['splitHistory', uid, groupIds] as const,
  iouFrom: (uid: string) => ['iouFrom', uid] as const,
  iouTo: (uid: string) => ['iouTo', uid] as const,
};
