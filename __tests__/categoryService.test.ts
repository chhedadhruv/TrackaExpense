import {beforeEach, describe, expect, it, jest} from '@jest/globals';

type Op = {op: string; path?: unknown; data?: unknown};
const mockCommits: Op[][] = [];
const mockGetDocs = jest.fn<(q: any) => Promise<any>>();

const mockSaveGoals =
  jest.fn<(uid: string, previous: any[], next: any[]) => Promise<void>>();
jest.mock('../src/services/GoalsService', () => ({
  saveGoals: (uid: string, previous: any[], next: any[]) =>
    mockSaveGoals(uid, previous, next),
}));

jest.mock('@react-native-firebase/firestore', () => {
  let autoId = 0;
  return {
    getFirestore: () => ({}),
    collection: (_db: unknown, ...path: string[]) => ({kind: 'col', path}),
    doc: (parent: any, ...rest: string[]) =>
      parent && parent.kind === 'col'
        ? {path: [...parent.path, rest[0] ?? `auto${++autoId}`]}
        : {path: rest},
    query: (col: any, ...filters: any[]) => ({col, filters}),
    where: (field: string, op: string, value: unknown) => ({field, op, value}),
    serverTimestamp: () => 'SERVER_TIME',
    deleteField: () => 'DELETE_FIELD',
    getDocs: (q: unknown) => mockGetDocs(q),
    writeBatch: () => {
      const ops: Op[] = [];
      return {
        set: (ref: any, data: unknown) =>
          ops.push({op: 'set', path: ref.path, data}),
        update: (ref: any, data: unknown) =>
          ops.push({op: 'update', path: ref.path, data}),
        delete: (ref: any) => ops.push({op: 'delete', path: ref.path}),
        commit: async () => {
          mockCommits.push(ops);
        },
      };
    },
  };
});

import {
  REWRITE_BATCH_SIZE,
  deleteCategory,
  finishRename,
  renameCategory,
  rewriteCategory,
} from '../src/services/CategoryService';
import {EMPTY_PREFS, type CustomCategory} from '../src/utils/customCategories';

const refs = (collection: string, n: number) => ({
  docs: Array.from({length: n}, (_, i) => ({
    ref: {path: ['users', 'u1', collection, `${collection}${i}`]},
  })),
});

/** Answers each query by its collection name. */
const answer = (counts: Record<string, number>) =>
  mockGetDocs.mockImplementation(async (q: any) => {
    const name = q.col.path[q.col.path.length - 1];
    return refs(name, counts[name] ?? 0);
  });

const pets: CustomCategory = {
  id: 'c1',
  name: 'Pets',
  type: 'expense',
  icon: 'pet',
  createdAtMs: 0,
  renamingFrom: null,
};

beforeEach(() => {
  mockCommits.length = 0;
  mockGetDocs.mockReset();
});

describe('rewriteCategory', () => {
  it('updates only the category of the person own entries, in batches', async () => {
    answer({transactions: REWRITE_BATCH_SIZE + 5, recurring: 2, budgets: 1});
    const moved = await rewriteCategory('u1', 'expense', 'Pets', 'Animals');
    expect(moved).toBe(REWRITE_BATCH_SIZE + 8);
    expect(mockCommits.map(c => c.length)).toEqual([REWRITE_BATCH_SIZE, 8]);
    const all = mockCommits.flat();
    expect(all.every(o => o.op === 'update')).toBe(true);
    expect(
      all.every(o => JSON.stringify(o.data) === '{"category":"Animals"}'),
    ).toBe(true);
    const queried = mockGetDocs.mock.calls.map(([q]) => ({
      col: q.col.path.join('/'),
      filters: q.filters,
    }));
    expect(queried).toEqual([
      {
        col: 'users/u1/transactions',
        filters: [
          {field: 'type', op: '==', value: 'expense'},
          {field: 'category', op: '==', value: 'Pets'},
        ],
      },
      {
        col: 'users/u1/recurring',
        filters: [
          {field: 'type', op: '==', value: 'expense'},
          {field: 'category', op: '==', value: 'Pets'},
        ],
      },
      {
        col: 'users/u1/budgets',
        filters: [{field: 'category', op: '==', value: 'Pets'}],
      },
    ]);
  });

  it('does not touch budgets for income and writes nothing when nothing matches', async () => {
    answer({});
    expect(await rewriteCategory('u1', 'income', 'Tips', 'Extras')).toBe(0);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(mockCommits).toEqual([]);
  });
});

describe('renameCategory', () => {
  it('marks the rename, moves the entries and then clears the mark', async () => {
    answer({transactions: 3});
    const prefs = {
      ...EMPTY_PREFS,
      order: {expense: ['Food', 'Pets'], income: [], goal: []},
    };
    const moved = await renameCategory('u1', pets, '  Animals ', prefs);
    expect(moved).toBe(3);
    const [first, rewrite, last] = mockCommits;
    expect(first[0]).toEqual({
      op: 'update',
      path: ['users', 'u1', 'categories', 'c1'],
      data: {name: 'Animals', renamingFrom: 'Pets', updatedAt: 'SERVER_TIME'},
    });
    expect((first[1].data as any).order.expense).toEqual(['Food', 'Animals']);
    expect(rewrite).toHaveLength(3);
    expect(last).toEqual([
      {
        op: 'update',
        path: ['users', 'u1', 'categories', 'c1'],
        data: {renamingFrom: 'DELETE_FIELD'},
      },
    ]);
  });

  it('can be finished after an interruption', async () => {
    answer({transactions: 1});
    const moved = await finishRename('u1', {
      ...pets,
      name: 'Animals',
      renamingFrom: 'Pets',
    });
    expect(moved).toBe(1);
    expect(mockGetDocs.mock.calls[0][0].filters[1].value).toBe('Pets');
    expect(mockCommits[0][0].data).toEqual({category: 'Animals'});
  });

  it('does nothing to finish when no rename is pending', async () => {
    expect(await finishRename('u1', pets)).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });
});

describe('goal categories', () => {
  const goal = (id: string, category: string) =>
    ({id, name: id, category, current: 0, target: 10} as any);
  const bike: CustomCategory = {...pets, id: 'g1', name: 'Bike', type: 'goal'};

  it('moves the goals through saveGoals and reads no collection', async () => {
    mockSaveGoals.mockResolvedValue(undefined);
    const goals = [goal('a', 'Bike'), goal('b', 'car'), goal('c', 'Bike')];
    const moved = await renameCategory('u1', bike, 'Cycle', EMPTY_PREFS, goals);
    expect(moved).toBe(2);
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockSaveGoals).toHaveBeenCalledTimes(1);
    const [uid, previous, next] = mockSaveGoals.mock.calls[0];
    expect(uid).toBe('u1');
    expect(previous).toBe(goals);
    expect(next.map(g => g.category)).toEqual(['Cycle', 'car', 'Cycle']);
    // The rename is marked, then cleared once the goals moved.
    expect(mockCommits[0][0].data).toMatchObject({renamingFrom: 'Bike'});
    expect(mockCommits[mockCommits.length - 1][0].data).toEqual({
      renamingFrom: 'DELETE_FIELD',
    });
  });

  it('skips saveGoals when no goal uses the category', async () => {
    mockSaveGoals.mockClear();
    expect(
      await rewriteCategory('u1', 'goal', 'Bike', 'Cycle', [goal('a', 'car')]),
    ).toBe(0);
    expect(mockSaveGoals).not.toHaveBeenCalled();
  });

  it('refuses without the current goals', async () => {
    await expect(
      rewriteCategory('u1', 'goal', 'Bike', 'Cycle'),
    ).rejects.toThrow('needs the current goals');
  });
});

describe('deleteCategory', () => {
  it('deletes the category and drops it from the preferences, nothing else', async () => {
    await deleteCategory('u1', pets, {
      hidden: {expense: [], income: [], goal: []},
      order: {expense: ['Pets', 'Food'], income: [], goal: []},
    });
    expect(mockCommits).toHaveLength(1);
    expect(mockCommits[0][0]).toEqual({
      op: 'delete',
      path: ['users', 'u1', 'categories', 'c1'],
    });
    expect((mockCommits[0][1].data as any).order.expense).toEqual(['Food']);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });
});
