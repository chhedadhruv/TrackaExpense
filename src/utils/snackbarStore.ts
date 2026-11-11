/**
 * State and timing for the app-wide snackbar, kept free of React so it can be unit tested and
 * called from services as well as screens.
 *
 * Rules:
 * - One snackbar is visible at a time. A new message replaces the current one at once, so the
 *   user never waits behind a stale message.
 * - The same message and variant shown again while it is still visible only restarts the timer
 *   (no flicker, same id).
 * - Success and info last 3 seconds, errors 5 seconds, a snackbar with an action 6 seconds.
 * - Blank messages are ignored.
 */

export type SnackbarVariant = 'success' | 'error' | 'info';

export interface SnackbarAction {
  label: string;
  onPress: () => void;
}

export interface SnackbarOptions {
  message: string;
  variant?: SnackbarVariant;
  /** Milliseconds on screen. Defaults depend on the variant. */
  duration?: number;
  action?: SnackbarAction;
}

export interface SnackbarItem {
  id: number;
  message: string;
  variant: SnackbarVariant;
  duration: number;
  action?: SnackbarAction;
}

export interface SnackbarState {
  current: SnackbarItem | null;
  /** Height of whatever the snackbar must float above (the tab bar), in dp. 0 when none. */
  bottomOffset: number;
}

export const DEFAULT_DURATION = {
  success: 3000,
  info: 3000,
  error: 5000,
  withAction: 6000,
} as const;

export const durationFor = (
  variant: SnackbarVariant,
  hasAction: boolean,
): number => {
  if (hasAction) {
    return DEFAULT_DURATION.withAction;
  }
  return DEFAULT_DURATION[variant];
};

type Listener = () => void;

let state: SnackbarState = {current: null, bottomOffset: 0};
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach(listener => listener());
};

const clearTimer = (): void => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
};

export const getSnackbarState = (): SnackbarState => state;

export const subscribeSnackbar = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const dismissSnackbar = (): void => {
  clearTimer();
  if (state.current === null) {
    return;
  }
  state = {...state, current: null};
  emit();
};

export const showSnackbar = (options: SnackbarOptions): void => {
  const message = options.message.trim();
  if (message.length === 0) {
    return;
  }
  const variant = options.variant ?? 'info';
  const duration =
    options.duration ?? durationFor(variant, options.action !== undefined);

  const current = state.current;
  const isRepeat =
    current !== null &&
    current.message === message &&
    current.variant === variant &&
    options.action === undefined &&
    current.action === undefined;

  clearTimer();
  if (!isRepeat) {
    state = {
      ...state,
      current: {
        id: nextId++,
        message,
        variant,
        duration,
        action: options.action,
      },
    };
    emit();
  }
  timer = setTimeout(dismissSnackbar, duration);
};

/** Called by the tab bar so the snackbar floats above it. */
export const setSnackbarBottomOffset = (offset: number): void => {
  const next = Number.isFinite(offset) && offset > 0 ? Math.round(offset) : 0;
  if (next === state.bottomOffset) {
    return;
  }
  state = {...state, bottomOffset: next};
  emit();
};

/** Test helper: back to the initial state with no timer running. */
export const resetSnackbarForTests = (): void => {
  clearTimer();
  state = {current: null, bottomOffset: 0};
  nextId = 1;
  listeners.clear();
};

/**
 * The API for screens and services: `import {snackbar} from '<path>/src/utils/snackbarStore'`.
 *
 *   snackbar.success('Expense added');
 *   snackbar.error('Could not delete the settlement');
 *   snackbar.info('Receipt removed');
 *
 * A stable object that needs no React context, so it works in components, effects and plain
 * services; the SnackbarHost (mounted once in App.tsx) draws the message. Use Alert only for
 * confirmations (delete, sign out, discard changes), never to report a result.
 */
export const snackbar = {
  show: showSnackbar,
  success: (
    message: string,
    options?: Omit<SnackbarOptions, 'message' | 'variant'>,
  ) => showSnackbar({...options, message, variant: 'success'}),
  error: (
    message: string,
    options?: Omit<SnackbarOptions, 'message' | 'variant'>,
  ) => showSnackbar({...options, message, variant: 'error'}),
  info: (
    message: string,
    options?: Omit<SnackbarOptions, 'message' | 'variant'>,
  ) => showSnackbar({...options, message, variant: 'info'}),
  dismiss: dismissSnackbar,
};
