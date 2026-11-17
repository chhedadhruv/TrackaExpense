import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: async (key: string, value: string) => {
      mockStore.set(key, value);
    },
    getItem: async (key: string) => mockStore.get(key) ?? null,
    removeItem: async (key: string) => {
      mockStore.delete(key);
    },
  },
}));

const DAY = 24 * 60 * 60 * 1000;

const load = async () => {
  jest.resetModules();
  // `require`, not `import()`: this Jest setup has no ESM support, and a fresh module copy is the
  // point (it simulates the app being started again).
  return require('../src/navigation/pendingInvite') as {
    savePendingInvite: (path: string, now?: number) => Promise<void>;
    takePendingInvite: (now?: number) => Promise<string | null>;
  };
};

describe('pending invite', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('keeps a path and hands it over once', async () => {
    const {savePendingInvite, takePendingInvite} = await load();
    await savePendingInvite('/split/join/g/t', 1000);
    expect(await takePendingInvite(2000)).toBe('/split/join/g/t');
    expect(await takePendingInvite(3000)).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('survives the app being closed (it is read back from the phone)', async () => {
    const first = await load();
    await first.savePendingInvite('/split/join/g/t', 1000);
    // A fresh start: nothing in memory, only what was saved.
    const second = await load();
    expect(await second.takePendingInvite(2000)).toBe('/split/join/g/t');
  });

  it('forgets a link older than a day', async () => {
    const {savePendingInvite, takePendingInvite} = await load();
    await savePendingInvite('/split/join/g/t', 1000);
    expect(await takePendingInvite(1000 + DAY + 1)).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('keeps only the newest link', async () => {
    const {savePendingInvite, takePendingInvite} = await load();
    await savePendingInvite('/split/join/a/x', 1000);
    await savePendingInvite('/split/join/b/y', 2000);
    expect(await takePendingInvite(3000)).toBe('/split/join/b/y');
  });

  it('ignores damaged saved data', async () => {
    const {takePendingInvite} = await load();
    mockStore.set('pendingInvitePath', '{not json');
    expect(await takePendingInvite(1000)).toBeNull();
  });
});
