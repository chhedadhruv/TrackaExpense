/**
 * Receipt photo URL on a transaction.
 *
 * Two fields exist for historical reasons: Add Expense has always written `image`, while the
 * details, edit and delete screens read `imageUrl` (so a receipt added through Add Expense never
 * showed). From now on every write sets both to the same value, and every read accepts either, so
 * old documents (only `image`), documents written by Edit (only `imageUrl`) and new ones all work.
 * Nothing is removed or backfilled.
 */

export interface ReceiptFields {
  imageUrl?: string | null;
  image?: string | null;
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** The receipt URL of a transaction, or null when it has none. `imageUrl` wins over `image`. */
export const receiptUrlOf = (transaction: ReceiptFields): string | null => {
  if (nonEmpty(transaction.imageUrl)) {
    return transaction.imageUrl;
  }
  if (nonEmpty(transaction.image)) {
    return transaction.image;
  }
  return null;
};

/**
 * Both fields for a write. Pass null to clear the receipt: clearing only one field would let the
 * other bring the old photo back through the read fallback.
 */
export const receiptFields = (
  url: string | null,
): {imageUrl: string | null; image: string | null} => {
  const value = nonEmpty(url) ? url : null;
  return {imageUrl: value, image: value};
};
