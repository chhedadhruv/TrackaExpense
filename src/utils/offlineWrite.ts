/**
 * A Firestore write only resolves once the server has confirmed it, so offline it stays pending
 * until the phone is back online (the write itself is kept on the phone and is not lost). A
 * screen that awaits it would spin for as long as the phone is offline.
 *
 * `settleWrite` waits for the confirmation when online, so errors (a rules rejection, for
 * example) reach the screen as before. When offline it does not wait: the write is already queued
 * on the phone, the function returns `queued: true` at once, and a later failure goes to
 * `onLateError` instead of being lost.
 */
export interface SettleResult {
  /** True when the write was left to sync later because the phone was offline. */
  queued: boolean;
}

export const settleWrite = async (
  write: Promise<unknown>,
  online: boolean,
  onLateError: (error: unknown) => void,
): Promise<SettleResult> => {
  if (online) {
    await write;
    return {queued: false};
  }
  write.catch(onLateError);
  return {queued: true};
};
