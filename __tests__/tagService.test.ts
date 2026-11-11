import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockBatchSet =
  jest.fn<(ref: unknown, data: unknown, opts: unknown) => void>();
const mockBatchCommit = jest.fn<() => Promise<void>>();
const mockGetDocs = jest.fn<(q: unknown) => Promise<any>>();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (...path: unknown[]) => ({kind: 'collection', path}),
  doc: (_db: unknown, ...path: unknown[]) => ({kind: 'doc', path}),
  query: (...parts: unknown[]) => ({kind: 'query', parts}),
  orderBy: (field: string, dir: string) => ({orderBy: [field, dir]}),
  limit: (n: number) => ({limit: n}),
  serverTimestamp: () => 'SERVER_TIME',
  getDocs: (q: unknown) => mockGetDocs(q),
  writeBatch: () => ({
    set: (ref: unknown, data: unknown, opts: unknown) =>
      mockBatchSet(ref, data, opts),
    commit: () => mockBatchCommit(),
  }),
}));

import {loadUserTags, recordTagUse} from '../src/services/TagService';

const snapshotOf = (docs: Array<Record<string, unknown> | undefined>) => ({
  docs: docs.map(data => ({data: () => data})),
});

describe('loadUserTags', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
  });

  it('returns the tag names in the order they came back', async () => {
    mockGetDocs.mockResolvedValue(snapshotOf([{name: 'Trip'}, {name: 'Work'}]));
    await expect(loadUserTags('u1')).resolves.toEqual(['Trip', 'Work']);
  });

  it('asks for the most recently used first, with a bounded read', async () => {
    mockGetDocs.mockResolvedValue(snapshotOf([]));
    await loadUserTags('u1');
    const q = mockGetDocs.mock.calls[0][0] as {parts: any[]};
    expect(q.parts[0].path).toEqual([expect.anything(), 'users', 'u1', 'tags']);
    expect(q.parts).toContainEqual({orderBy: ['lastUsedAt', 'desc']});
    expect(q.parts).toContainEqual({limit: 100});
  });

  it('skips documents without a usable name and cleans the rest', async () => {
    mockGetDocs.mockResolvedValue(
      snapshotOf([
        {lastUsedAt: 1},
        {name: 42},
        {name: '   '},
        undefined,
        {name: ' #Goa  Trip '},
      ]),
    );
    await expect(loadUserTags('u1')).resolves.toEqual(['Goa Trip']);
  });
});

describe('recordTagUse', () => {
  beforeEach(() => {
    mockBatchSet.mockReset();
    mockBatchCommit.mockReset();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it('does nothing when no tags were used', async () => {
    await recordTagUse('u1', [], ['Trip']);
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('adds a new tag with its name and creation time', async () => {
    await recordTagUse('u1', ['Goa Trip'], []);
    expect(mockBatchSet).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = mockBatchSet.mock.calls[0];
    expect((ref as {path: unknown[]}).path).toEqual([
      'users',
      'u1',
      'tags',
      't_goa%20trip',
    ]);
    expect(data).toEqual({
      name: 'Goa Trip',
      createdAt: 'SERVER_TIME',
      lastUsedAt: 'SERVER_TIME',
    });
    expect(opts).toEqual({merge: true});
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('only refreshes lastUsedAt for a known tag and keeps its spelling', async () => {
    await recordTagUse('u1', ['trip'], ['Trip']);
    const [, data] = mockBatchSet.mock.calls[0];
    expect(data).toEqual({lastUsedAt: 'SERVER_TIME'});
  });

  it('handles new and known tags together in one batch', async () => {
    await recordTagUse('u1', ['Trip', 'Fresh'], ['Trip']);
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockBatchSet.mock.calls[0][1]).toEqual({lastUsedAt: 'SERVER_TIME'});
    expect((mockBatchSet.mock.calls[1][1] as {name: string}).name).toBe(
      'Fresh',
    );
  });
});
