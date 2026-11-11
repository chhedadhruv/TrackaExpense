import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  DEFAULT_DURATION,
  durationFor,
  getSnackbarState,
  resetSnackbarForTests,
  setSnackbarBottomOffset,
  snackbar,
  subscribeSnackbar,
} from '../src/utils/snackbarStore';

describe('snackbarStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetSnackbarForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a message with the right variant and default duration', () => {
    snackbar.success('Expense added');
    const item = getSnackbarState().current;
    expect(item?.message).toBe('Expense added');
    expect(item?.variant).toBe('success');
    expect(item?.duration).toBe(DEFAULT_DURATION.success);
  });

  it('keeps errors on screen longer than success', () => {
    expect(durationFor('error', false)).toBeGreaterThan(
      durationFor('success', false),
    );
    expect(durationFor('success', true)).toBe(DEFAULT_DURATION.withAction);
  });

  it('dismisses itself after the duration', () => {
    snackbar.success('Done');
    jest.advanceTimersByTime(DEFAULT_DURATION.success - 1);
    expect(getSnackbarState().current).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(getSnackbarState().current).toBeNull();
  });

  it('replaces the visible message with a new one at once', () => {
    snackbar.success('First');
    const firstId = getSnackbarState().current?.id;
    snackbar.error('Second');
    const second = getSnackbarState().current;
    expect(second?.message).toBe('Second');
    expect(second?.variant).toBe('error');
    expect(second?.id).not.toBe(firstId);
  });

  it('only restarts the timer when the same message is shown again', () => {
    snackbar.success('Saved');
    const id = getSnackbarState().current?.id;
    jest.advanceTimersByTime(2500);
    snackbar.success('Saved');
    expect(getSnackbarState().current?.id).toBe(id);
    jest.advanceTimersByTime(2500);
    expect(getSnackbarState().current).not.toBeNull();
    jest.advanceTimersByTime(500);
    expect(getSnackbarState().current).toBeNull();
  });

  it('treats the same text with a different variant as a new message', () => {
    snackbar.info('Heads up');
    const id = getSnackbarState().current?.id;
    snackbar.error('Heads up');
    expect(getSnackbarState().current?.id).not.toBe(id);
  });

  it('ignores blank messages', () => {
    snackbar.success('   ');
    expect(getSnackbarState().current).toBeNull();
  });

  it('keeps an action and gives it the longer duration', () => {
    const onPress = jest.fn();
    snackbar.info('Moved', {action: {label: 'Open', onPress}});
    const item = getSnackbarState().current;
    expect(item?.action?.label).toBe('Open');
    expect(item?.duration).toBe(DEFAULT_DURATION.withAction);
  });

  it('honours an explicit duration', () => {
    snackbar.success('Quick', {duration: 1000});
    jest.advanceTimersByTime(1000);
    expect(getSnackbarState().current).toBeNull();
  });

  it('dismiss clears the message and the pending timer', () => {
    snackbar.success('Gone soon');
    snackbar.dismiss();
    expect(getSnackbarState().current).toBeNull();
    snackbar.error('Later');
    jest.advanceTimersByTime(DEFAULT_DURATION.success);
    expect(getSnackbarState().current?.message).toBe('Later');
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSnackbar(listener);
    snackbar.success('One');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    snackbar.success('Two');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stores a clean bottom offset and ignores bad values', () => {
    setSnackbarBottomOffset(83.4);
    expect(getSnackbarState().bottomOffset).toBe(83);
    setSnackbarBottomOffset(NaN);
    expect(getSnackbarState().bottomOffset).toBe(0);
    setSnackbarBottomOffset(-5);
    expect(getSnackbarState().bottomOffset).toBe(0);
  });
});
