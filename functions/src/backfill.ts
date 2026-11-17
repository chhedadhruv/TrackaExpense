import fs from 'node:fs';
import {initializeApp} from 'firebase-admin/app';
import {
  getFirestore,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import {changedFields, resolveCurrency, type Fields} from './derive';
import {goalDocUpToDate, planGoalSync} from './goals';
import {getCurrencyExponent} from './money';
import {deriveForKind, makeLookups, type Kind} from './sources';

/**
 * Backfills the additive minor-unit fields (amountMinor, balanceMinor, savingsGoalsMinor, ...)
 * on existing documents, using exactly the same derivation as the triggers.
 *
 *   node lib/backfill.js --project <id> [--apply] [--only users,transactions] [--limit N]
 *                        [--report file.json] [--expect-clean]
 *
 * - Dry run is the default: it reads, reports and writes nothing.
 * - Idempotent and resumable: a document that is already up to date is left alone, so running it
 *   again (after a stop, or after an old app wrote something) only touches what is still missing.
 * - Every write is conditional on the document not having changed since it was read; if an old
 *   app wrote in between, that write fails and is counted as a conflict (run again).
 * - It only ever sets new fields; no legacy field is changed or removed.
 * - Values that cannot be converted are skipped and listed by path in the report.
 * - Applying to a real project (not the emulator) needs --confirm-project <same id> and
 *   --backup-confirmed, and is meant to be run only after the owner approves it.
 * - The report holds counts and document paths only, never amounts, names or emails.
 */

interface Args {
  project: string;
  apply: boolean;
  only: string[] | null;
  limit: number | null;
  report: string | null;
  expectClean: boolean;
  confirmProject: string | null;
  backupConfirmed: boolean;
}

interface Target {
  kind: Kind;
  label: string;
  query: (db: Firestore) => Query;
  /** Collection groups also match same-named collections elsewhere; keep only the right ones. */
  accept: (path: string) => boolean;
  /**
   * The savings goals pass: it does not derive fields on the scanned document, it creates the
   * missing `users/{uid}/goals/{goalId}` documents from the user's `savingsGoals` array.
   */
  goals?: boolean;
}

const TARGETS: Target[] = [
  {
    kind: 'user',
    label: 'users',
    query: db => db.collection('users'),
    accept: () => true,
  },
  {
    kind: 'transaction',
    label: 'transactions',
    query: db => db.collectionGroup('transactions'),
    accept: path => path.startsWith('users/'),
  },
  {
    kind: 'split',
    label: 'splits',
    query: db => db.collectionGroup('splits'),
    accept: path => path.startsWith('groups/'),
  },
  {
    kind: 'settlement',
    label: 'settlements',
    query: db => db.collectionGroup('settlements'),
    accept: path => path.startsWith('groups/'),
  },
  {
    kind: 'group',
    label: 'groups',
    query: db => db.collection('groups'),
    accept: () => true,
  },
  {
    kind: 'iou',
    label: 'ious',
    query: db => db.collection('ious'),
    accept: () => true,
  },
  {
    kind: 'savingsHistory',
    label: 'savingsHistory',
    query: db => db.collectionGroup('savingsHistory'),
    accept: path => path.startsWith('users/'),
  },
  {
    kind: 'user',
    label: 'goals',
    query: db => db.collection('users'),
    accept: () => true,
    goals: true,
  },
];

interface Stats {
  scanned: number;
  upToDate: number;
  wouldUpdate: number;
  updated: number;
  conflicts: number;
  failed: number;
  docsWithSkippedValues: number;
  skippedByField: Record<string, number>;
  fieldsToWrite: Record<string, number>;
  rounding: {
    docsRounded: number;
    maxAbsErrorMinor: number;
    sumAbsErrorMinor: number;
  };
}

const newStats = (): Stats => ({
  scanned: 0,
  upToDate: 0,
  wouldUpdate: 0,
  updated: 0,
  conflicts: 0,
  failed: 0,
  docsWithSkippedValues: 0,
  skippedByField: {},
  fieldsToWrite: {},
  rounding: {docsRounded: 0, maxAbsErrorMinor: 0, sumAbsErrorMinor: 0},
});

const bump = (record: Record<string, number>, key: string): void => {
  record[key] = (record[key] ?? 0) + 1;
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(2);
};

export const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    project: '',
    apply: false,
    only: null,
    limit: null,
    report: null,
    expectClean: false,
    confirmProject: null,
    backupConfirmed: false,
  };
  const value = (i: number, flag: string): string => {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      return fail(`${flag} needs a value`);
    }
    return next;
  };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--project':
        args.project = value(i, '--project');
        i += 1;
        break;
      case '--apply':
        args.apply = true;
        break;
      case '--only':
        args.only = value(i, '--only').split(',');
        i += 1;
        break;
      case '--limit':
        args.limit = Number(value(i, '--limit'));
        if (!Number.isInteger(args.limit) || args.limit < 1) {
          fail('--limit must be a positive integer');
        }
        i += 1;
        break;
      case '--report':
        args.report = value(i, '--report');
        i += 1;
        break;
      case '--expect-clean':
        args.expectClean = true;
        break;
      case '--confirm-project':
        args.confirmProject = value(i, '--confirm-project');
        i += 1;
        break;
      case '--backup-confirmed':
        args.backupConfirmed = true;
        break;
      default:
        fail(`Unknown argument: ${argv[i]}`);
    }
  }
  if (args.project === '') {
    fail('--project is required (there is deliberately no default project)');
  }
  const labels = TARGETS.map(t => t.label);
  for (const name of args.only ?? []) {
    if (!labels.includes(name)) {
      fail(
        `--only: unknown collection "${name}" (known: ${labels.join(', ')})`,
      );
    }
  }
  return args;
};

/** Generic name for a skipped value, so goal ids never end up in a report. */
const fieldKey = (name: string): string =>
  name.replace(/^savingsGoals\.[^.]+\./, 'savingsGoals.*.');

const ROUNDING_PAIRS: Array<[string, string]> = [
  ['amount', 'amountMinor'],
  ['previousAmount', 'previousAmountMinor'],
  ['newAmount', 'newAmountMinor'],
  ['balance', 'balanceMinor'],
];

/** How far the converted minor value is from the legacy value (in minor units). */
const recordRounding = (
  stats: Stats,
  data: Fields,
  derivedFields: Fields,
): void => {
  const currency = resolveCurrency(derivedFields.currency, data.currency);
  const scale = 10 ** getCurrencyExponent(currency);
  for (const [legacy, minor] of ROUNDING_PAIRS) {
    const minorValue = derivedFields[minor];
    const raw = data[legacy];
    if (
      typeof minorValue !== 'number' ||
      (typeof raw !== 'number' && typeof raw !== 'string')
    ) {
      continue;
    }
    const legacyMajor = Number(String(raw).replace(/,/g, ''));
    if (!Number.isFinite(legacyMajor)) {
      continue;
    }
    const error = Math.abs(legacyMajor * scale - minorValue);
    if (error > 1e-6) {
      stats.rounding.docsRounded += 1;
      stats.rounding.maxAbsErrorMinor = Math.max(
        stats.rounding.maxAbsErrorMinor,
        error,
      );
      stats.rounding.sumAbsErrorMinor += error;
    }
  }
};

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (args.apply && !emulator) {
    if (args.confirmProject !== args.project || !args.backupConfirmed) {
      fail(
        'Refusing to write to a real project. Use --apply together with ' +
          `--confirm-project ${args.project} and --backup-confirmed, and only after the owner ` +
          'approved this run and a fresh Firestore export exists.',
      );
    }
  }

  initializeApp({projectId: args.project});
  const db = getFirestore();
  const lookups = makeLookups(db, true);
  const writer = db.bulkWriter();
  writer.onWriteError(
    error =>
      error.code !== 9 &&
      error.code !== 5 &&
      error.code !== 6 &&
      error.failedAttempts < 3,
  );

  const report = {
    startedAt: new Date().toISOString(),
    project: args.project,
    mode: args.apply ? 'apply' : 'dry-run',
    emulator,
    targets: {} as Record<string, Stats>,
    skippedDocuments: [] as Array<{path: string; fields: string[]}>,
    skippedDocumentsTruncated: false,
  };
  const SKIPPED_LIMIT = 2000;

  for (const target of TARGETS) {
    if (args.only && !args.only.includes(target.label)) {
      continue;
    }
    const stats = newStats();
    report.targets[target.label] = stats;
    let query = target.query(db);
    if (args.limit !== null) {
      query = query.limit(args.limit);
    }
    const stream =
      query.stream() as unknown as AsyncIterable<QueryDocumentSnapshot>;

    for await (const snap of stream) {
      const path = snap.ref.path;
      if (!target.accept(path)) {
        continue;
      }
      stats.scanned += 1;
      if (stats.scanned % 500 === 0) {
        console.log(`${target.label}: ${stats.scanned} scanned`);
      }
      const data = snap.data() as Fields;
      if (target.goals) {
        // Goals the user has in the array but no document for yet. Existing documents are left as
        // they are (the trigger keeps them current); one that differs from the array is reported.
        const plan = planGoalSync(undefined, data.savingsGoals, data.currency);
        if (plan.upserts.length === 0) {
          stats.upToDate += 1;
          continue;
        }
        const goalsRef = snap.ref.collection('goals');
        const refs = plan.upserts.map(u => goalsRef.doc(u.id));
        const existing = await db.getAll(...refs);
        const missing: number[] = [];
        let differs = false;
        plan.upserts.forEach((upsert, i) => {
          if (!existing[i].exists) {
            missing.push(i);
          } else if (
            !goalDocUpToDate(existing[i].data() as Fields, upsert.fields)
          ) {
            differs = true;
          }
        });
        if (differs) {
          stats.docsWithSkippedValues += 1;
          bump(stats.skippedByField, 'goals.differs');
          if (report.skippedDocuments.length < SKIPPED_LIMIT) {
            report.skippedDocuments.push({path, fields: ['goals.differs']});
          } else {
            report.skippedDocumentsTruncated = true;
          }
        }
        if (missing.length === 0) {
          stats.upToDate += 1;
          continue;
        }
        stats.wouldUpdate += 1;
        for (const i of missing) {
          bump(stats.fieldsToWrite, 'goals');
          if (args.apply) {
            // create() fails when the document appeared meanwhile (a trigger or the new app wrote
            // it); that is counted as a conflict and a second run finds nothing left to do.
            writer.create(refs[i], plan.upserts[i].fields).then(
              () => {
                stats.updated += 1;
              },
              (error: {code?: number}) => {
                if (error.code === 6) {
                  stats.conflicts += 1;
                } else {
                  stats.failed += 1;
                }
              },
            );
          }
        }
        continue;
      }
      const uid = path.startsWith('users/') ? path.split('/')[1] : undefined;
      const derived = await deriveForKind(target.kind, data, uid, lookups);

      if (derived.skipped.length > 0) {
        stats.docsWithSkippedValues += 1;
        for (const name of derived.skipped) {
          bump(stats.skippedByField, fieldKey(name));
        }
        if (report.skippedDocuments.length < SKIPPED_LIMIT) {
          report.skippedDocuments.push({
            path,
            fields: derived.skipped.map(fieldKey),
          });
        } else {
          report.skippedDocumentsTruncated = true;
        }
      }
      recordRounding(stats, data, derived.fields);

      const changed = changedFields(data, derived.fields);
      if (!changed) {
        stats.upToDate += 1;
        continue;
      }
      stats.wouldUpdate += 1;
      for (const key of Object.keys(changed)) {
        bump(stats.fieldsToWrite, key);
      }
      if (args.apply) {
        // Conditional on the document being unchanged since it was read (an old app may be
        // writing at the same time); a conflict is counted and fixed by running again.
        writer
          .update(snap.ref, changed, {lastUpdateTime: snap.updateTime})
          .then(
            () => {
              stats.updated += 1;
            },
            (error: {code?: number}) => {
              if (error.code === 9) {
                stats.conflicts += 1;
              } else {
                stats.failed += 1;
              }
            },
          );
      }
    }
    await writer.flush();
    stats.rounding.maxAbsErrorMinor = round4(stats.rounding.maxAbsErrorMinor);
    stats.rounding.sumAbsErrorMinor = round4(stats.rounding.sumAbsErrorMinor);
    console.log(
      `${target.label}: ${JSON.stringify({
        ...stats,
        skippedByField: undefined,
        fieldsToWrite: undefined,
        rounding: undefined,
      })}`,
    );
  }
  await writer.close();

  const totals = Object.values(report.targets).reduce(
    (sum, s) => ({
      scanned: sum.scanned + s.scanned,
      wouldUpdate: sum.wouldUpdate + s.wouldUpdate,
      updated: sum.updated + s.updated,
      conflicts: sum.conflicts + s.conflicts,
      failed: sum.failed + s.failed,
      skipped: sum.skipped + s.docsWithSkippedValues,
    }),
    {
      scanned: 0,
      wouldUpdate: 0,
      updated: 0,
      conflicts: 0,
      failed: 0,
      skipped: 0,
    },
  );
  const summary = {...report, totals};
  if (args.report) {
    fs.writeFileSync(args.report, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`report written to ${args.report}`);
  }
  console.log(`${report.mode} done: ${JSON.stringify(totals)}`);

  if (totals.conflicts > 0 || totals.failed > 0) {
    console.error(
      'Some writes did not apply (conflicts or failures); run it again.',
    );
    process.exit(1);
  }
  if (args.expectClean && totals.wouldUpdate > 0) {
    console.error(
      `--expect-clean: ${totals.wouldUpdate} documents still need updating`,
    );
    process.exit(1);
  }
};

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
