import {describe, expect, it} from '@jest/globals';
import {isOnlineState} from '../src/utils/connectivity';

describe('isOnlineState', () => {
  it('is online when connected and reachable', () => {
    expect(isOnlineState({isConnected: true, isInternetReachable: true})).toBe(
      true,
    );
  });

  it('is offline with no network', () => {
    expect(
      isOnlineState({isConnected: false, isInternetReachable: false}),
    ).toBe(false);
    expect(isOnlineState({isConnected: false, isInternetReachable: null})).toBe(
      false,
    );
  });

  it('is offline when a network is attached but the internet is not reachable', () => {
    expect(isOnlineState({isConnected: true, isInternetReachable: false})).toBe(
      false,
    );
  });

  it('treats an unknown state as online, so startup never shows the banner', () => {
    expect(isOnlineState({isConnected: null, isInternetReachable: null})).toBe(
      true,
    );
    expect(isOnlineState({isConnected: true, isInternetReachable: null})).toBe(
      true,
    );
  });
});
