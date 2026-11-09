// Integration test of the backfill against the Firestore emulator (no Functions emulator, so the
// triggers cannot interfere). Seeds old-shaped data, then checks: dry run writes nothing, apply
// fills the additive fields, a second run reports clean, bad values are skipped and listed, and
// the guard refuses to write to a real project.
//
// Run: yarn test:backfill   (needs the Firebase CLI via functions/node_modules and JDK 21).
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const project = process.env.GCLOUD_PROJECT || 'demo-trackaexpense-backfill';
initializeApp({projectId: project});
const db = getFirestore();
const script = path.resolve('functions/lib/backfill.js');

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const run = (args, env = process.env) =>
  spawnSync(process.execPath, [script, '--project', project, ...args], {
    env,
    encoding: 'utf8',
  });

const reportFile = path.join(os.tmpdir(), `backfill-report-${Date.now()}.json`);
const readReport = () => JSON.parse(fs.readFileSync(reportFile, 'utf8'));

// ---- seed (old-app shape: legacy fields only)
await db.doc('users/u1').set({
  email: 'a@example.com',
  currency: 'USD',
  balance: 12.345,
  phone: 'keep-me',
  savingsGoals: [{id: 'g1', current: 100, target: 500, monthly: 50}],
});
await db.doc('users/u2').set({email: 'b@example.com', balance: 100});
await db
  .doc('users/u1/transactions/t1')
  .set({amount: '123.4567', date: '2025-5-4', type: 'expense'});
await db.doc('users/u1/transactions/t2').set({
  amount: '10000000000000000000000000000',
  date: '2025-01-02',
  type: 'expense',
});
await db
  .doc('users/u2/transactions/t3')
  .set({amount: 50, currency: 'AED', date: '2025-02-03', type: 'income'});
await db
  .doc('groups/g1/splits/s1')
  .set({amount: 33.3333333333, paidBy: {userId: 'u1'}, splitUsers: []});
await db
  .doc('groups/g1/settlements/se1')
  .set({amount: 250.5, from: {userId: 'u2'}, to: {userId: 'u1'}});
await db
  .doc('ious/i1')
  .set({amount: '75.25', fromEmail: 'a@example.com', toEmail: 'b@example.com'});
await db
  .doc('users/u1/savingsHistory/h1')
  .set({amount: 500, previousAmount: 1000, newAmount: 1500});
await db
  .doc('users/u1/savingsHistory/h2')
  .set({type: 'goal_created', newGoal: {target: 5}});
// A same-named collection elsewhere must be ignored.
await db.doc('other/x/transactions/ignored').set({amount: '5'});

await step('dry run reports what would change and writes nothing', async () => {
  const result = run(['--report', reportFile]);
  assert.equal(result.status, 0, result.stderr);
  const report = readReport();
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.emulator, true);
  assert.equal(report.targets.users.scanned, 2);
  assert.equal(report.targets.users.wouldUpdate, 2);
  assert.equal(report.targets.transactions.scanned, 3);
  assert.equal(report.targets.transactions.wouldUpdate, 3);
  assert.equal(report.targets.splits.wouldUpdate, 1);
  assert.equal(report.targets.settlements.wouldUpdate, 1);
  assert.equal(report.targets.ious.wouldUpdate, 1);
  assert.equal(report.targets.savingsHistory.scanned, 2);
  assert.equal(report.targets.savingsHistory.wouldUpdate, 1);
  assert.equal(report.totals.updated, 0);
  // Nothing was written.
  assert.equal(
    (await db.doc('users/u1/transactions/t1').get()).get('amountMinor'),
    undefined,
  );
  assert.equal((await db.doc('users/u1').get()).get('balanceMinor'), undefined);
});

await step(
  'skipped values are listed by path, with no amounts in the report',
  async () => {
    const report = readReport();
    assert.deepEqual(report.skippedDocuments, [
      {path: 'users/u1/transactions/t2', fields: ['amount']},
    ]);
    assert.equal(report.targets.transactions.docsWithSkippedValues, 1);
    assert.equal(
      JSON.stringify(report).includes('10000000000000000000000000000'),
      false,
    );
    assert.equal(JSON.stringify(report).includes('a@example.com'), false);
  },
);

await step(
  'rounding statistics show the 4-decimal and float values',
  async () => {
    const report = readReport();
    assert.equal(report.targets.transactions.rounding.docsRounded, 1);
    assert.ok(report.targets.transactions.rounding.maxAbsErrorMinor <= 0.5);
    assert.ok(report.targets.splits.rounding.maxAbsErrorMinor <= 0.5);
  },
);

await step(
  'apply fills the additive fields and leaves legacy fields alone',
  async () => {
    const result = run(['--apply', '--report', reportFile]);
    assert.equal(result.status, 0, result.stderr);
    const report = readReport();
    assert.equal(report.totals.updated, report.totals.wouldUpdate);
    assert.equal(report.totals.conflicts, 0);
    assert.equal(report.totals.failed, 0);

    const t1 = (await db.doc('users/u1/transactions/t1').get()).data();
    assert.equal(t1.amountMinor, 12346);
    assert.equal(t1.currency, 'USD');
    assert.equal(t1.dateISO, '2025-05-04');
    assert.equal(t1.amount, '123.4567');
    assert.equal(t1.date, '2025-5-4');

    const t2 = (await db.doc('users/u1/transactions/t2').get()).data();
    assert.equal(t2.amountMinor, undefined);
    assert.equal(t2.currency, 'USD');
    assert.equal(t2.amount, '10000000000000000000000000000');

    const t3 = (await db.doc('users/u2/transactions/t3').get()).data();
    assert.equal(t3.amountMinor, 5000);
    assert.equal(t3.currency, 'AED');

    const u1 = (await db.doc('users/u1').get()).data();
    assert.equal(u1.balanceMinor, 1235);
    assert.equal(u1.phone, 'keep-me');
    assert.equal(u1.balance, 12.345);
    assert.deepEqual(u1.savingsGoalsMinor, {
      g1: {currentMinor: 10000, targetMinor: 50000, monthlyMinor: 5000},
    });
    assert.deepEqual(u1.savingsGoals, [
      {id: 'g1', current: 100, target: 500, monthly: 50},
    ]);
    assert.equal((await db.doc('users/u2').get()).get('balanceMinor'), 10000);

    assert.equal(
      (await db.doc('groups/g1/splits/s1').get()).get('amountMinor'),
      3333,
    );
    assert.equal(
      (await db.doc('groups/g1/splits/s1').get()).get('currency'),
      'USD',
    );
    assert.equal(
      (await db.doc('groups/g1/settlements/se1').get()).get('amountMinor'),
      25050,
    );
    assert.equal(
      (await db.doc('groups/g1/settlements/se1').get()).get('currency'),
      'INR',
    );
    assert.equal((await db.doc('ious/i1').get()).get('amountMinor'), 7525);
    assert.equal(
      (await db.doc('users/u1/savingsHistory/h1').get()).get('newAmountMinor'),
      150000,
    );
    assert.equal(
      (await db.doc('users/u1/savingsHistory/h2').get()).get('currency'),
      undefined,
    );
    assert.equal(
      (await db.doc('other/x/transactions/ignored').get()).get('amountMinor'),
      undefined,
    );
  },
);

await step(
  'a second run is clean (idempotent) and still reports the skipped value',
  async () => {
    const before = (
      await db.doc('users/u1/transactions/t1').get()
    ).updateTime.toMillis();
    const result = run(['--expect-clean', '--report', reportFile]);
    assert.equal(result.status, 0, result.stderr);
    const report = readReport();
    assert.equal(report.totals.wouldUpdate, 0);
    assert.equal(report.totals.skipped, 1);
    const apply = run(['--apply']);
    assert.equal(apply.status, 0, apply.stderr);
    assert.equal(
      (await db.doc('users/u1/transactions/t1').get()).updateTime.toMillis(),
      before,
    );
  },
);

await step(
  'an old app edit is picked up by the next run (resumable)',
  async () => {
    await db.doc('users/u1/transactions/t1').update({amount: '200'});
    const dry = run(['--expect-clean']);
    assert.equal(dry.status, 1);
    const apply = run(['--apply']);
    assert.equal(apply.status, 0, apply.stderr);
    assert.equal(
      (await db.doc('users/u1/transactions/t1').get()).get('amountMinor'),
      20000,
    );
  },
);

await step('--only and --limit narrow the scan', async () => {
  const result = run([
    '--only',
    'users',
    '--limit',
    '1',
    '--report',
    reportFile,
  ]);
  assert.equal(result.status, 0, result.stderr);
  const report = readReport();
  assert.deepEqual(Object.keys(report.targets), ['users']);
  assert.equal(report.targets.users.scanned, 1);
});

await step(
  'guards: no project, unknown flag, and no write to a real project',
  async () => {
    const noProject = spawnSync(process.execPath, [script], {
      env: process.env,
      encoding: 'utf8',
    });
    assert.equal(noProject.status, 2);
    assert.match(noProject.stderr, /--project is required/);

    const unknown = run(['--bogus']);
    assert.equal(unknown.status, 2);

    // Without the emulator host the run targets a real project: applying must be refused before
    // anything is read or written.
    const realEnv = {...process.env};
    delete realEnv.FIRESTORE_EMULATOR_HOST;
    const refused = run(['--apply'], realEnv);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /Refusing to write to a real project/);
    const halfConfirmed = run(
      ['--apply', '--confirm-project', project],
      realEnv,
    );
    assert.equal(halfConfirmed.status, 2);
    const wrongProject = run(
      ['--apply', '--confirm-project', 'other-project', '--backup-confirmed'],
      realEnv,
    );
    assert.equal(wrongProject.status, 2);
  },
);

fs.rmSync(reportFile, {force: true});
console.log(`\n${passed} backfill checks passed`);
process.exit(0);
