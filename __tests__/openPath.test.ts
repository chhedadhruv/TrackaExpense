import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockNavigate = jest.fn<(path: string) => void>();

jest.mock('expo-router', () => ({
  router: {navigate: (path: string) => mockNavigate(path)},
}));

describe('pathFromLink', () => {
  it('turns an app link into a path', () => {
    const {pathFromLink} = require('../src/navigation/openPath');
    expect(pathFromLink('trackaexpense://split/invitations')).toBe(
      '/split/invitations',
    );
    expect(pathFromLink('trackaexpense:///home')).toBe('/home');
    expect(pathFromLink('trackaexpense://split/group/g1?groupName=Trip')).toBe(
      '/split/group/g1?groupName=Trip',
    );
  });

  it('keeps a path that has no scheme', () => {
    const {pathFromLink} = require('../src/navigation/openPath');
    expect(pathFromLink('/savings')).toBe('/savings');
    expect(pathFromLink('savings')).toBe('/savings');
  });
});

describe('openPath', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    jest.resetModules();
  });

  it('waits until the navigator is ready, then opens the newest path only', () => {
    const {
      openPath,
      markNavigationReady,
    } = require('../src/navigation/openPath');
    openPath('/split/invitations');
    openPath('/savings');
    expect(mockNavigate).not.toHaveBeenCalled();
    markNavigationReady();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/savings');
  });

  it('opens a path straight away once the navigator is ready', () => {
    const {
      openPath,
      markNavigationReady,
    } = require('../src/navigation/openPath');
    markNavigationReady();
    expect(mockNavigate).not.toHaveBeenCalled();
    openPath('/statistic');
    expect(mockNavigate).toHaveBeenCalledWith('/statistic');
  });

  it('does not throw when the path matches no screen', () => {
    const {
      openPath,
      markNavigationReady,
    } = require('../src/navigation/openPath');
    markNavigationReady();
    mockNavigate.mockImplementation(() => {
      throw new Error('no such route');
    });
    expect(() => openPath('/nowhere')).not.toThrow();
  });
});
