import {File, Paths} from 'expo-file-system';
import Share from 'react-native-share';

export type ShareCsvResult = 'shared' | 'cancelled';

const CANCEL_MESSAGES = ['User did not share', 'User cancelled'];

/**
 * Writes the CSV text to a file in the app's cache folder (the system cleans it up; nothing is
 * left in the person's documents) and opens the share sheet for it. Needs no storage permission.
 * Resolves 'cancelled' when the person closes the sheet; any other failure throws.
 */
export const shareCsv = async (
  fileName: string,
  content: string,
  title: string,
): Promise<ShareCsvResult> => {
  const file = new File(Paths.cache, fileName);
  file.create({overwrite: true});
  file.write(content);
  if (!file.exists) {
    throw new Error('The CSV file could not be created.');
  }
  try {
    await Share.open({
      title,
      url: file.uri,
      type: 'text/csv',
      failOnCancel: false,
    });
    return 'shared';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (CANCEL_MESSAGES.some(m => message.includes(m))) {
      return 'cancelled';
    }
    throw error;
  }
};
