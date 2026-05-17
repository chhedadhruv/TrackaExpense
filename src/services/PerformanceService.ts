import perf from '@react-native-firebase/perf';

type StopFn = () => Promise<void>;

export const startTrace = async (traceName: string): Promise<StopFn | null> => {
  try {
    const trace = await perf().startTrace(traceName);
    return async () => {
      try {
        await trace.stop();
      } catch (_) {}
    };
  } catch (_) {
    return null;
  }
};

export const traceFetchTransactions = (): Promise<StopFn | null> =>
  startTrace('fetch_transactions');

export const traceUploadReceipt = (): Promise<StopFn | null> =>
  startTrace('upload_receipt');

export const traceCalculateStatistics = (): Promise<StopFn | null> =>
  startTrace('calculate_statistics');
