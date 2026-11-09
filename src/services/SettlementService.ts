import {getApp} from '@react-native-firebase/app';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';

/**
 * Recording and deleting a settlement is done by the server in one all-or-nothing step
 * (functions/src/settlement.ts): the settlement, the splits-list entry, both balances and the
 * transactions. Screens must not write those documents or another user's balance themselves.
 */

export interface RecordSettlementArgs {
  groupId: string;
  /** Email of the person who paid. */
  fromEmail: string;
  /** Email of the person who was paid. */
  toEmail: string;
  /** The amount as typed; the server rounds it to the currency's minor unit. */
  amount: string;
  note: string;
  includeInTransactions: boolean;
  /**
   * Identifies this attempt. Send the same value again when retrying so the settlement can never
   * be applied twice.
   */
  requestId: string;
}

export interface RecordSettlementResult {
  settlementId: string;
  splitId: string;
  alreadyRecorded: boolean;
}

export interface DeleteSettlementResult {
  deleted: boolean;
  settlementRemoved: boolean;
}

const functions = () => getFunctions(getApp(), 'asia-south1');

export const recordSettlement = async (
  args: RecordSettlementArgs,
): Promise<RecordSettlementResult> => {
  const call = httpsCallable<RecordSettlementArgs, RecordSettlementResult>(
    functions(),
    'recordSettlement',
  );
  return (await call(args)).data;
};

export const deleteSettlement = async (
  groupId: string,
  splitId: string,
): Promise<DeleteSettlementResult> => {
  const call = httpsCallable<
    {groupId: string; splitId: string},
    DeleteSettlementResult
  >(functions(), 'deleteSettlement');
  return (await call({groupId, splitId})).data;
};
