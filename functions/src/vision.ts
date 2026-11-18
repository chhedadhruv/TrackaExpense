export const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

interface VisionResponse {
  responses?: {
    fullTextAnnotation?: {text?: string};
    error?: {message?: string};
  }[];
}

/**
 * Text in an image through Cloud Vision (document text detection, which suits printed receipts).
 * Signs in with the function's own service account, so no key is stored anywhere. Needs the
 * Cloud Vision API enabled on the project. Throws when the API answers with an error.
 */
export const recognizeText = async (
  image: Buffer,
  getToken: () => Promise<string>,
  fetchFn: typeof fetch = fetch,
): Promise<string> => {
  const response = await fetchFn(VISION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getToken()}`,
    },
    body: JSON.stringify({
      requests: [
        {
          image: {content: image.toString('base64')},
          features: [{type: 'DOCUMENT_TEXT_DETECTION'}],
          imageContext: {languageHints: ['en', 'hi']},
        },
      ],
    }),
  });
  const body = (await response.json().catch(() => ({}))) as VisionResponse;
  const first = body.responses?.[0];
  if (!response.ok || first?.error) {
    throw new Error(
      first?.error?.message ?? `Vision answered ${response.status}`,
    );
  }
  return first?.fullTextAnnotation?.text ?? '';
};
