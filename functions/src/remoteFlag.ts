import {getRemoteConfig} from 'firebase-admin/remote-config';
import * as logger from 'firebase-functions/logger';

interface FlagTemplate {
  parameters?: Record<
    string,
    {defaultValue?: {value?: string; useInAppDefault?: boolean}} | undefined
  >;
}

/** True only when the parameter's default value is exactly "true". Anything else is off. */
export const flagFromTemplate = (
  template: FlagTemplate | undefined,
  name: string,
): boolean => template?.parameters?.[name]?.defaultValue?.value === 'true';

const CACHE_MS = 60_000;
const cache = new Map<string, {at: number; value: boolean}>();

/**
 * Reads a feature flag from the project's Remote Config template, the same one the app reads, so
 * one switch controls both. Off when the parameter is missing or the read fails: a feature flag
 * that cannot be read must not turn a feature on. Cached for a minute per instance.
 */
export const isFlagOn = async (
  name: string,
  nowMs: number = Date.now(),
): Promise<boolean> => {
  const override = process.env[`FLAG_${name.toUpperCase()}`];
  if (override === 'true' || override === 'false') {
    // Used by the emulator tests, where there is no Remote Config to read.
    return override === 'true';
  }
  const hit = cache.get(name);
  if (hit && nowMs - hit.at < CACHE_MS) {
    return hit.value;
  }
  try {
    const template = await getRemoteConfig().getTemplate();
    const value = flagFromTemplate(template as FlagTemplate, name);
    cache.set(name, {at: nowMs, value});
    return value;
  } catch (error) {
    logger.warn('Could not read the Remote Config flag; treating it as off', {
      name,
      error: String(error),
    });
    return false;
  }
};
