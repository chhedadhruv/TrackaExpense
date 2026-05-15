/**
 * Formats a numeric value for TextInput display, adding thousands-separator commas.
 * The raw numeric string (without commas) should always be kept in state;
 * strip commas on onChangeText before storing.
 *
 * @example formatInputAmount('1000.50') → '1,000.50'
 */
export const formatInputAmount = (value: string | number): string => {
  if (!value && value !== 0) return '';
  const str = value.toString().replace(/,/g, '');
  const [integer, decimal] = str.split('.');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${formattedInteger}.${decimal}` : formattedInteger;
};

/**
 * Formats a "YYYY-MM-DD" date string for human-readable display.
 * Transactions always store dates as plain strings, not Timestamps.
 *
 * @example formatDisplayDate('2024-03-15') → 'March 15, 2024'
 */
export const formatDisplayDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Returns today's date as a "YYYY-MM-DD" string for use as a default form value.
 */
export const todayAsYMD = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

/**
 * Formats a Firestore Timestamp date for display in split screens.
 * Always use the `date ?? createdAt` fallback for legacy split records
 * that predate the `date` field.
 */
export const formatTimestampDate = (
  timestamp: {toDate(): Date} | undefined | null,
  fallback?: {toDate(): Date},
): string => {
  const ts = timestamp ?? fallback;
  if (!ts) return '';
  return ts.toDate().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
