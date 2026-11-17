import {ONESIGNAL_URL} from './push';

export interface NotifyDeps {
  fetchFn: typeof fetch;
  /** The OneSignal REST API key; undefined when the secret is not set (nothing is sent). */
  apiKey: string | undefined;
  appId: string;
}

export interface NotifyMessage {
  title: string;
  body: string;
  /** Free-form data the app reads when the notification is tapped. */
  data: Record<string, string>;
}

/**
 * Sends a push to people by Firebase uid, from server code that has already decided who may be
 * told (a trigger acting on the person's own data). The callable `sendPush` is for the app; this
 * one never takes a recipient from a client. Returns true only when OneSignal accepted it.
 */
export const notifyUids = async (
  deps: NotifyDeps,
  uids: readonly string[],
  message: NotifyMessage,
): Promise<boolean> => {
  if (!deps.apiKey || uids.length === 0) {
    return false;
  }
  try {
    const response = await deps.fetchFn(ONESIGNAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${deps.apiKey}`,
      },
      body: JSON.stringify({
        app_id: deps.appId,
        target_channel: 'push',
        include_aliases: {external_id: [...new Set(uids)]},
        headings: {en: message.title},
        contents: {en: message.body},
        data: message.data,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {id?: unknown};
    return response.ok && typeof result.id === 'string' && result.id !== '';
  } catch {
    return false;
  }
};
