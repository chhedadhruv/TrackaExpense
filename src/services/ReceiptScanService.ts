import {getApp} from '@react-native-firebase/app';
import {getAuth} from '@react-native-firebase/auth';
import {getFunctions, httpsCallable} from '@react-native-firebase/functions';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  putFile,
  ref as createStorageRef,
} from '@react-native-firebase/storage';
import type {ReceiptGuess} from '../utils/receiptScan';

/**
 * Receipt scanning. The photo goes to the person's own `bills/{uid}/` folder, the same place a
 * saved receipt lives, so a scanned photo can be kept as the expense's receipt without a second
 * upload. The `scanReceipt` Cloud Function reads it and only proposes values; this service never
 * writes a transaction.
 */

export interface UploadedReceipt {
  /** The local file that was uploaded, to tell later whether the form still shows it. */
  localUri: string;
  storagePath: string;
  downloadUrl: string;
}

const fileNameFor = (localUri: string): string => {
  const base = localUri.substring(localUri.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  const name = (dot > 0 ? base.slice(0, dot) : base).replace(
    /[^A-Za-z0-9_-]/g,
    '',
  );
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase() : 'jpg';
  return `${name || 'receipt'}${Date.now()}.${extension || 'jpg'}`;
};

export const uploadReceipt = async (
  localUri: string,
): Promise<UploadedReceipt> => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('Not signed in');
  }
  const storagePath = `bills/${uid}/${fileNameFor(localUri)}`;
  const storageRef = createStorageRef(getStorage(), storagePath);
  await putFile(storageRef, localUri);
  return {localUri, storagePath, downloadUrl: await getDownloadURL(storageRef)};
};

export const requestScan = async (
  storagePath: string,
): Promise<ReceiptGuess> => {
  const call = httpsCallable<{storagePath: string}, ReceiptGuess>(
    getFunctions(getApp(), 'asia-south1'),
    'scanReceipt',
  );
  return (await call({storagePath})).data;
};

/** Removes a photo that was uploaded for a scan but is no longer the expense's receipt. */
export const discardUploadedReceipt = async (
  uploaded: UploadedReceipt,
): Promise<void> => {
  await deleteObject(createStorageRef(getStorage(), uploaded.storagePath));
};
