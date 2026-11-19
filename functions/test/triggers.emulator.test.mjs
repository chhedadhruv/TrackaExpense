// Integration test: real Firestore and Functions emulators, writing the way OLD installed apps
// write (legacy fields only) and checking that the triggers add the minor-unit fields.
//
// Run: yarn test:triggers   (needs the Firebase CLI installed globally and JDK 21 or newer).
// Uses a demo- project id, so no live project is ever touched.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);

initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'demo-trackaexpense-functions',
});
const db = getFirestore();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Polls until `check(data)` is true, then returns the snapshot data.
const waitFor = async (ref, check, label, timeoutMs = 45000) => {
  const start = Date.now();
  for (;;) {
    const snap = await ref.get();
    if (snap.exists && check(snap.data())) return snap;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `timed out waiting for: ${label}; last data keys: ${Object.keys(
          snap.data() || {},
        ).join(',')}`,
      );
    }
    await sleep(500);
  }
};

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const uid = 'u1';
const user = db.collection('users').doc(uid);

// The first write after startup can arrive before the function is registered, so write once and
// let waitFor give it plenty of time.
await user.set({
  name: 'Test',
  email: 'test@example.com',
  currency: 'USD',
  balance: 12.345,
  phone: 'keep-me',
});

await step(
  'user: balanceMinor derived from balance, other fields untouched',
  async () => {
    const snap = await waitFor(
      user,
      d => d.balanceMinor !== undefined,
      'users balanceMinor',
    );
    assert.equal(snap.get('balanceMinor'), 1235);
    assert.equal(snap.get('balance'), 12.345);
    assert.equal(snap.get('phone'), 'keep-me');
  },
);

await step(
  'user: savings goals map keyed by goal id, goals array not rewritten',
  async () => {
    const goals = [
      {id: 'g1', name: 'Trip', current: 100, target: 500, monthly: 50},
    ];
    await user.update({savingsGoals: goals});
    const snap = await waitFor(
      user,
      d => d.savingsGoalsMinor?.g1 !== undefined,
      'savingsGoalsMinor',
    );
    assert.deepEqual(snap.get('savingsGoalsMinor'), {
      g1: {currentMinor: 10000, targetMinor: 50000, monthlyMinor: 5000},
    });
    assert.deepEqual(snap.get('savingsGoals'), goals);
  },
);

const tx = user.collection('transactions').doc('t1');
await step(
  'transaction: string amount with 4 decimals and an unpadded date',
  async () => {
    await tx.set({
      title: 'Lunch',
      amount: '123.4567',
      type: 'expense',
      category: 'Food',
      date: '2025-5-4',
    });
    const snap = await waitFor(
      tx,
      d => d.amountMinor !== undefined,
      'transaction amountMinor',
    );
    assert.equal(snap.get('amountMinor'), 12346);
    assert.equal(snap.get('currency'), 'USD');
    assert.equal(snap.get('dateISO'), '2025-05-04');
    assert.equal(snap.get('amount'), '123.4567');
    assert.equal(snap.get('date'), '2025-5-4');
  },
);

await step(
  'transaction: an old app edits the amount, the minor field follows',
  async () => {
    await tx.update({amount: '200'});
    await waitFor(tx, d => d.amountMinor === 20000, 'amountMinor after edit');
  },
);

await step(
  'transaction: unconvertible amount is skipped and nothing breaks',
  async () => {
    const bad = user.collection('transactions').doc('t-bad');
    await bad.set({
      title: 'Huge',
      amount: '10000000000000000000000000000',
      type: 'expense',
      category: 'Other',
      date: '2025-01-02',
    });
    const snap = await waitFor(
      bad,
      d => d.currency !== undefined,
      'currency on bad transaction',
    );
    assert.equal(snap.get('amountMinor'), undefined);
    assert.equal(snap.get('amount'), '10000000000000000000000000000');
    assert.equal(snap.get('dateISO'), '2025-01-02');
  },
);

await step('transaction: no trigger loop (updateTime settles)', async () => {
  const before = (await tx.get()).updateTime.toMillis();
  await sleep(4000);
  const after = (await tx.get()).updateTime.toMillis();
  assert.equal(after, before);
});

await step(
  'split: currency from the payer, amountMinor from a float total',
  async () => {
    const split = db
      .collection('groups')
      .doc('gr1')
      .collection('splits')
      .doc('s1');
    await split.set({
      title: 'Dinner',
      amount: 33.3333333333,
      paidBy: {userId: uid, email: 'test@example.com', name: 'Test'},
      splitUsers: [],
    });
    const snap = await waitFor(
      split,
      d => d.amountMinor !== undefined,
      'split amountMinor',
    );
    assert.equal(snap.get('amountMinor'), 3333);
    assert.equal(snap.get('currency'), 'USD');
  },
);

await step('split: a currency already on the document wins', async () => {
  const split = db
    .collection('groups')
    .doc('gr1')
    .collection('splits')
    .doc('s2');
  await split.set({
    title: 'Hotel',
    amount: 100,
    currency: 'AED',
    paidBy: {userId: uid},
    splitUsers: [],
  });
  const snap = await waitFor(
    split,
    d => d.amountMinor !== undefined,
    'split with currency',
  );
  assert.equal(snap.get('currency'), 'AED');
  assert.equal(snap.get('amountMinor'), 10000);
});

await step('settlement: currency from from.userId', async () => {
  const settlement = db
    .collection('groups')
    .doc('gr1')
    .collection('settlements')
    .doc('se1');
  await settlement.set({
    amount: 250.5,
    from: {userId: uid, name: 'Test'},
    to: {userId: 'u2'},
    status: 'settled',
  });
  const snap = await waitFor(
    settlement,
    d => d.amountMinor !== undefined,
    'settlement amountMinor',
  );
  assert.equal(snap.get('amountMinor'), 25050);
  assert.equal(snap.get('currency'), 'USD');
});

await step(
  'savings history: three amounts, goal events untouched',
  async () => {
    const history = user.collection('savingsHistory');
    await history.doc('h1').set({
      type: 'add',
      goalId: 'g1',
      amount: 500,
      previousAmount: 1000,
      newAmount: 1500,
    });
    await history
      .doc('h2')
      .set({type: 'goal_created', goalId: 'g1', newGoal: {target: 5}});
    const h1 = await waitFor(
      history.doc('h1'),
      d => d.amountMinor !== undefined,
      'history amountMinor',
    );
    assert.equal(h1.get('amountMinor'), 50000);
    assert.equal(h1.get('previousAmountMinor'), 100000);
    assert.equal(h1.get('newAmountMinor'), 150000);
    await sleep(3000);
    const h2 = await history.doc('h2').get();
    assert.equal(h2.get('currency'), undefined);
    assert.equal(h2.get('amountMinor'), undefined);
  },
);

await step('iou: currency from the lender account found by email', async () => {
  const iou = db.collection('ious').doc('i1');
  await iou.set({
    amount: '75.25',
    fromEmail: 'test@example.com',
    toEmail: 'x@example.com',
    status: 'pending',
  });
  const snap = await waitFor(
    iou,
    d => d.amountMinor !== undefined,
    'iou amountMinor',
  );
  assert.equal(snap.get('amountMinor'), 7525);
  assert.equal(snap.get('currency'), 'USD');
});

await step(
  'group: memberIds follows members as they change, legacy fields untouched',
  async () => {
    await db.collection('users').doc('u2').set({email: 'Second@Example.com'});
    const group = db.collection('groups').doc('gr1');
    await group.set({
      name: 'Trip',
      members: ['test@example.com'],
      pendingInvites: ['nobody@example.com'],
    });
    let snap = await waitFor(
      group,
      d => Array.isArray(d.memberIds),
      'group memberIds',
    );
    assert.deepEqual(snap.get('memberIds'), ['u1']);
    assert.deepEqual(snap.get('members'), ['test@example.com']);
    assert.deepEqual(snap.get('pendingInvites'), ['nobody@example.com']);

    // An old app accepts an invitation: it adds the email only. A lower-case form of a stored
    // mixed-case email is still found.
    await group.update({
      members: ['test@example.com', 'Second@Example.com', 'ghost@example.com'],
    });
    snap = await waitFor(
      group,
      d => d.memberIds.length === 2,
      'group memberIds after join',
    );
    assert.deepEqual(snap.get('memberIds'), ['u1', 'u2']);

    // A member leaves.
    await group.update({members: ['Second@Example.com']});
    snap = await waitFor(
      group,
      d => d.memberIds.length === 1 && d.memberIds[0] === 'u2',
      'group memberIds after leave',
    );
    assert.deepEqual(snap.get('members'), ['Second@Example.com']);
  },
);

// ---- lookupUsersByContact (callable) through the Functions and Auth emulators
const project = process.env.GCLOUD_PROJECT || 'demo-trackaexpense-functions';
const callLookup = async (data, idToken) => {
  const response = await fetch(
    `http://127.0.0.1:5001/${project}/asia-south1/lookupUsersByContact`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? {Authorization: `Bearer ${idToken}`} : {}),
      },
      body: JSON.stringify({data}),
    },
  );
  return {status: response.status, body: await response.json()};
};

await step('lookup: signed-out callers are refused', async () => {
  const {status, body} = await callLookup({emails: ['test@example.com']});
  assert.equal(status, 401);
  assert.equal(body.error.status, 'UNAUTHENTICATED');
});

await step(
  'lookup: returns only uid, email, name and avatar, in request order',
  async () => {
    const signUp = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: 'caller@example.com',
          password: 'not-a-real-password',
          returnSecureToken: true,
        }),
      },
    );
    const {idToken} = await signUp.json();
    assert.ok(idToken);

    await db.collection('users').doc('u3').set({
      email: 'third@example.com',
      displayName: 'Third',
      avatar: 'https://example.com/a.png',
      phone: '5551234',
      balance: 50,
      fcmToken: 'secret-token',
    });

    const {status, body} = await callLookup(
      {
        emails: ['test@example.com', 'Third@Example.com', 'nobody@example.com'],
        phones: ['5551234', '000'],
      },
      idToken,
    );
    assert.equal(status, 200);
    const result = body.result;
    assert.deepEqual(result.emails[0], {
      uid: 'u1',
      email: 'test@example.com',
      name: 'Test',
      avatar: null,
    });
    assert.equal(
      result.emails[1].uid,
      'u3',
      'falls back to the lower-case form',
    );
    assert.equal(result.emails[2], null);
    assert.deepEqual(result.phones[0], {
      uid: 'u3',
      email: 'third@example.com',
      name: 'Third',
      avatar: 'https://example.com/a.png',
    });
    assert.equal(result.phones[1], null);
    const text = JSON.stringify(body);
    assert.equal(text.includes('secret-token'), false);
    assert.equal(text.includes('balance'), false);
  },
);

await step(
  'lookup: bad input and oversized requests are rejected',
  async () => {
    const signIn = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: 'caller@example.com',
          password: 'not-a-real-password',
          returnSecureToken: true,
        }),
      },
    );
    const {idToken} = await signIn.json();
    const bad = await callLookup({emails: 'x'}, idToken);
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.status, 'INVALID_ARGUMENT');
    const tooMany = await callLookup(
      {emails: Array.from({length: 31}, (_, i) => `${i}@example.com`)},
      idToken,
    );
    assert.equal(tooMany.status, 400);
  },
);

// ---- Budget alerts (flag enable_budgets is forced on by .env.demo-trackaexpense-functions) ------
const todayKolkata = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const periodKey = todayKolkata.slice(0, 7);

const budgetUid = 'ub1';
const budgetUser = db.collection('users').doc(budgetUid);
const alertsOf = async () =>
  (await budgetUser.collection('budgetAlerts').get()).docs
    .map(d => d.id)
    .sort();
const addExpense = async (id, amount, extra = {}) => {
  // The way an old installed app writes: legacy fields only; the triggers derive the rest.
  await budgetUser
    .collection('transactions')
    .doc(id)
    .set({
      title: id,
      type: 'expense',
      amount,
      category: 'Food',
      date: todayKolkata,
      ...extra,
    });
  await waitFor(
    budgetUser.collection('transactions').doc(id),
    d => d.amountMinor !== undefined && d.dateISO !== undefined,
    `${id} derived`,
  );
};

await budgetUser.set({
  name: 'Budget user',
  email: 'budget@example.com',
  currency: 'INR',
});
await budgetUser
  .collection('budgets')
  .doc('food')
  .set({
    name: 'Food',
    category: 'Food',
    period: 'monthly',
    limitMinor: 10000,
    currency: 'INR',
    thresholds: {50: true, 80: true, 100: true, 120: true},
    enabled: true,
  });

await step('budgets: below 50 percent raises no alert', async () => {
  await addExpense('e1', '45');
  await sleep(4000);
  assert.deepEqual(await alertsOf(), []);
});

await step('budgets: 55 percent raises the 50 alert only', async () => {
  await addExpense('e2', '10');
  await waitFor(
    budgetUser.collection('budgetAlerts').doc(`food_${periodKey}_50`),
    d => d.threshold === 50,
    '50 alert',
  );
  await sleep(2000);
  assert.deepEqual(await alertsOf(), [`food_${periodKey}_50`]);
});

await step(
  'budgets: 85 percent adds 80, 105 percent adds 100, never 120 yet',
  async () => {
    await addExpense('e3', '30');
    await waitFor(
      budgetUser.collection('budgetAlerts').doc(`food_${periodKey}_80`),
      d => d.threshold === 80,
      '80 alert',
    );
    await addExpense('e4', '20');
    const hundred = await waitFor(
      budgetUser.collection('budgetAlerts').doc(`food_${periodKey}_100`),
      d => d.threshold === 100,
      '100 alert',
    );
    assert.equal(hundred.get('spentMinor'), 10500);
    assert.equal(hundred.get('limitMinor'), 10000);
    assert.equal(hundred.get('pushed'), false); // no OneSignal key in the emulator
    await sleep(2000);
    assert.deepEqual(await alertsOf(), [
      `food_${periodKey}_100`,
      `food_${periodKey}_50`,
      `food_${periodKey}_80`,
    ]);
  },
);

await step(
  'budgets: rewriting transactions does not fire an alert twice',
  async () => {
    const first = await budgetUser
      .collection('budgetAlerts')
      .doc(`food_${periodKey}_50`)
      .get();
    await budgetUser
      .collection('transactions')
      .doc('e1')
      .update({notes: 'touched'});
    await budgetUser
      .collection('transactions')
      .doc('e2')
      .update({notes: 'touched'});
    await sleep(4000);
    assert.equal((await alertsOf()).length, 3);
    const again = await budgetUser
      .collection('budgetAlerts')
      .doc(`food_${periodKey}_50`)
      .get();
    assert.deepEqual(again.get('createdAt'), first.get('createdAt'));
  },
);

await step(
  'budgets: settlements, other categories and income do not count toward 120',
  async () => {
    await addExpense('s1', '500', {category: 'Settlement', isSettlement: true});
    await addExpense('t1', '500', {category: 'Travel'});
    await addExpense('i1', '500', {type: 'income'});
    await sleep(4000);
    assert.equal((await alertsOf()).length, 3);
  },
);

await step(
  'budgets: a Food expense that really reaches 120 adds the 120 alert',
  async () => {
    await addExpense('e5', '20');
    await waitFor(
      budgetUser.collection('budgetAlerts').doc(`food_${periodKey}_120`),
      d => d.threshold === 120,
      '120 alert',
    );
  },
);

await step(
  'budgets: core sends one push per new alert, none on a rerun, and follows the period',
  async () => {
    const {evaluateBudgets} = require('../lib/budgetAlerts.js');
    const coreUid = 'ub2';
    const coreUser = db.collection('users').doc(coreUid);
    await coreUser.set({name: 'Core', currency: 'INR'});
    const tx = (id, amountMinor, dateISO) =>
      coreUser
        .collection('transactions')
        .doc(id)
        .set({
          type: 'expense',
          amountMinor,
          dateISO,
          currency: 'INR',
          category: 'Rent',
          amount: String(amountMinor / 100),
          date: dateISO,
        });
    await tx('a', 9000, '2026-11-10'); // 90 percent of a 100.00 budget in November
    await tx('b', 5000, '2026-10-20'); // October: ignored by a November budget
    await sleep(4000); // let the triggers finish before the budget exists
    await coreUser
      .collection('budgets')
      .doc('all')
      .set({
        name: '',
        period: 'monthly',
        limitMinor: 10000,
        currency: 'INR',
        thresholds: {50: true, 80: true, 100: false, 120: false},
        enabled: true,
      });

    const sent = [];
    const deps = {
      db,
      apiKey: 'test-key',
      appId: 'app',
      fetchFn: async (url, init) => {
        sent.push(JSON.parse(init.body));
        return {ok: true, json: async () => ({id: `n${sent.length}`})};
      },
      now: () => Date.UTC(2026, 10, 15, 6, 0, 0),
    };
    const first = await evaluateBudgets(deps, coreUid);
    assert.deepEqual(first.created.sort(), [
      'all_2026-11_50',
      'all_2026-11_80',
    ]);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[0].include_aliases.external_id, [coreUid]);
    assert.ok(sent.every(m => m.data.type === 'budget_alert'));
    assert.match(sent[0].contents.en, /percent of your budget/);
    const pushed = await coreUser
      .collection('budgetAlerts')
      .doc('all_2026-11_80')
      .get();
    assert.equal(pushed.get('pushed'), true);

    const second = await evaluateBudgets(deps, coreUid);
    assert.deepEqual(second.created, []);
    assert.equal(sent.length, 2);

    // Overlapping runs: only one of them creates a given alert.
    await coreUser.collection('transactions').doc('c').set({
      type: 'expense',
      amountMinor: 20000,
      dateISO: '2026-11-11',
      currency: 'INR',
      category: 'Rent',
      amount: '200',
      date: '2026-11-11',
    });
    await sleep(4000);
    await coreUser
      .collection('budgets')
      .doc('all')
      .update({
        thresholds: {50: true, 80: true, 100: true, 120: true},
      });
    const before = sent.length;
    const runs = await Promise.all(
      [1, 2, 3].map(() => evaluateBudgets(deps, coreUid)),
    );
    const createdNow = runs.flatMap(r => r.created).sort();
    assert.deepEqual(createdNow, ['all_2026-11_100', 'all_2026-11_120']);
    assert.equal(sent.length - before, 2);

    // December: a new period starts at zero, so nothing fires.
    const december = await evaluateBudgets(
      {...deps, now: () => Date.UTC(2026, 11, 2, 6, 0, 0)},
      coreUid,
    );
    assert.deepEqual(december.created, []);
  },
);

// ---- Recurring transactions (the job is called directly; scheduled functions do not run here) --
await step(
  'recurring: creates a due rule once, moves the balance once, and reruns do nothing',
  async () => {
    const {runRecurring} = require('../lib/recurringJob.js');
    const sent = [];
    const deps = nowMs => ({
      db,
      apiKey: 'test-key',
      appId: 'app',
      fetchFn: async (_url, init) => {
        sent.push(JSON.parse(init.body));
        return {ok: true, json: async () => ({id: `n${sent.length}`})};
      },
      now: () => nowMs,
    });
    const ruUid = 'ur1';
    const ruUser = db.collection('users').doc(ruUid);
    await ruUser.set({name: 'Recurring user', currency: 'INR', balance: 1000});
    const rules = ruUser.collection('recurring');
    const rent = {
      title: 'Rent',
      type: 'expense',
      category: 'Rent',
      amountMinor: 1500000,
      currency: 'INR',
      frequency: 'monthly',
      startDate: '2026-01-31',
      nextDueDate: '2026-01-31',
      timeZone: 'Asia/Kolkata',
      enabled: true,
    };
    await rules.doc('rent').set(rent);

    // Not due yet: January 30 in India.
    const early = await runRecurring(deps(Date.UTC(2026, 0, 30, 6, 0, 0)));
    assert.deepEqual(early.created, []);

    // Due: January 31.
    const jan31 = Date.UTC(2026, 0, 31, 6, 0, 0);
    const first = await runRecurring(deps(jan31));
    assert.deepEqual(first.created, ['rec_rent_2026-01-31']);
    const tx = await ruUser
      .collection('transactions')
      .doc('rec_rent_2026-01-31')
      .get();
    assert.equal(tx.get('amount'), '15000.00');
    assert.equal(tx.get('amountMinor'), 1500000);
    assert.equal(tx.get('type'), 'expense');
    assert.equal(tx.get('date'), '2026-01-31');
    assert.equal(tx.get('source'), 'recurring');
    assert.equal(tx.get('recurringId'), 'rent');
    assert.equal((await ruUser.get()).get('balance'), -14000);
    assert.equal(
      (await rules.doc('rent').get()).get('nextDueDate'),
      '2026-02-28',
    );
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].include_aliases.external_id, [ruUid]);
    assert.equal(sent[0].data.type, 'recurring_logged');

    // The same moment again, and three overlapping runs: nothing new and no second balance change.
    const again = await runRecurring(deps(jan31));
    assert.deepEqual(again.created, []);
    const feb28 = Date.UTC(2026, 1, 28, 6, 0, 0);
    const runs = await Promise.all(
      [1, 2, 3].map(() => runRecurring(deps(feb28))),
    );
    assert.deepEqual(
      runs.flatMap(r => r.created),
      ['rec_rent_2026-02-28'],
    );
    assert.equal((await ruUser.get()).get('balance'), -29000);
    assert.equal(
      (await rules.doc('rent').get()).get('nextDueDate'),
      '2026-03-31',
    );
    assert.equal((await ruUser.collection('transactions').get()).size, 2);
  },
);

await step(
  'card due: one reminder per stage at 9 local, none for a paid bill, reruns send nothing',
  async () => {
    const {runCardDue} = require('../lib/cardDueJob.js');
    const sentBodies = [];
    const deps = nowMs => ({
      db,
      apiKey: 'test-key',
      appId: 'app',
      fetchFn: async (_url, init) => {
        sentBodies.push(JSON.parse(init.body));
        return {ok: true, json: async () => ({id: 'n1'})};
      },
      now: () => nowMs,
    });
    const u = db.collection('users').doc('ucd');
    await u.set({name: 'Card due', currency: 'INR', balance: 0});
    await u.collection('cards').doc('cd1').set({
      name: 'HDFC',
      last4: '1234',
      statementDay: 15,
      dueDay: 3,
      currency: 'INR',
    });
    await u.collection('transactions').doc('p1').set({
      type: 'expense',
      cardId: 'cd1',
      amountMinor: 123450,
      currency: 'INR',
      date: '2026-11-10',
    });
    // 2026-11-30 09:00 in India is 03:30 UTC: three days before the due date of 2026-12-03.
    const soon = Date.UTC(2026, 10, 30, 3, 30, 0);
    const first = await runCardDue(deps(soon));
    assert.ok(first.sent.includes('cd1_2026-11-15_soon'));
    assert.equal(sentBodies.length >= 1, true);
    const before = sentBodies.length;
    const again = await runCardDue(deps(soon));
    assert.equal(again.sent.includes('cd1_2026-11-15_soon'), false);
    assert.equal(sentBodies.length, before);
    // Another hour of the day: nothing.
    const wrongHour = await runCardDue(deps(Date.UTC(2026, 10, 30, 7, 30, 0)));
    assert.equal(wrongHour.sent.includes('cd1_2026-11-15_soon'), false);
    // A paid bill gets no reminder on the due day.
    await u
      .collection('cardPayments')
      .doc('cd1_2026-11-15')
      .set({cardId: 'cd1', amountMinor: 123450});
    const due = await runCardDue(deps(Date.UTC(2026, 11, 3, 3, 30, 0)));
    assert.equal(due.sent.includes('cd1_2026-11-15_today'), false);
  },
);

await step(
  'recurring: a card rule creates the transaction with its card and leaves the balance alone',
  async () => {
    const {runRecurring} = require('../lib/recurringJob.js');
    const u = db.collection('users').doc('ur-card');
    await u.set({name: 'Card user', currency: 'INR', balance: 1000});
    await u.collection('recurring').doc('netflix').set({
      title: 'Netflix',
      type: 'expense',
      category: 'Entertainment',
      amountMinor: 64900,
      currency: 'INR',
      frequency: 'monthly',
      startDate: '2026-11-16',
      nextDueDate: '2026-11-16',
      timeZone: 'Asia/Kolkata',
      enabled: true,
      cardId: 'card1',
    });
    const out = await runRecurring({
      db,
      apiKey: undefined,
      appId: 'app',
      fetchFn: async () => ({ok: false, json: async () => ({})}),
      now: () => Date.UTC(2026, 10, 16, 6, 0, 0),
    });
    assert.ok(out.created.includes('rec_netflix_2026-11-16'));
    const tx = await u
      .collection('transactions')
      .doc('rec_netflix_2026-11-16')
      .get();
    assert.equal(tx.get('cardId'), 'card1');
    assert.equal(tx.get('amountMinor'), 64900);
    assert.equal((await u.get()).get('balance'), 1000);
  },
);

await step(
  'recurring: income adds to the balance, late occurrences are skipped, a disabled rule is ignored',
  async () => {
    const {runRecurring} = require('../lib/recurringJob.js');
    const deps = nowMs => ({
      db,
      apiKey: undefined,
      appId: 'app',
      fetchFn: async () => ({ok: false, json: async () => ({})}),
      now: () => nowMs,
    });
    const u = db.collection('users').doc('ur2');
    await u.set({name: 'Second', currency: 'INR', balance: 0});
    const rules = u.collection('recurring');
    await rules.doc('salary').set({
      title: 'Salary',
      type: 'income',
      category: 'Salary',
      amountMinor: 5000050,
      currency: 'INR',
      frequency: 'weekly',
      startDate: '2026-11-02',
      nextDueDate: '2026-11-02',
      timeZone: 'Asia/Kolkata',
      enabled: true,
    });
    await rules.doc('off').set({
      title: 'Paused',
      type: 'expense',
      category: 'Other',
      amountMinor: 100,
      currency: 'INR',
      frequency: 'weekly',
      startDate: '2026-11-17',
      nextDueDate: '2026-11-17',
      timeZone: 'Asia/Kolkata',
      enabled: false,
    });
    await rules
      .doc('broken')
      .set({title: 'No amount', type: 'expense', frequency: 'weekly'});

    // Monday Nov 16 in India: Nov 2 and 9 are too late, Nov 16 is due today.
    const out = await runRecurring(deps(Date.UTC(2026, 10, 16, 6, 0, 0)));
    assert.ok(out.created.includes('rec_salary_2026-11-16'));
    assert.ok(!out.created.some(id => id.startsWith('rec_off_')));
    assert.equal(out.failed, 0);
    assert.equal(out.skipped >= 2, true);
    const txs = (await u.collection('transactions').get()).docs.map(d => d.id);
    assert.deepEqual(txs, ['rec_salary_2026-11-16']);
    assert.equal((await u.get()).get('balance'), 50000.5);
    assert.equal(
      (await rules.doc('salary').get()).get('nextDueDate'),
      '2026-11-23',
    );
    assert.equal(
      (await rules.doc('off').get()).get('nextDueDate'),
      '2026-11-17',
    );
  },
);

await step(
  'recurring: each rule follows its own time zone, and an end date finishes the rule',
  async () => {
    const {runRecurring} = require('../lib/recurringJob.js');
    const deps = nowMs => ({
      db,
      apiKey: undefined,
      appId: 'app',
      fetchFn: async () => ({ok: false, json: async () => ({})}),
      now: () => nowMs,
    });
    const u = db.collection('users').doc('ur3');
    await u.set({name: 'Third', currency: 'USD', balance: 0});
    const base = {
      type: 'expense',
      category: 'Other',
      amountMinor: 999,
      currency: 'USD',
      frequency: 'monthly',
      startDate: '2026-03-10',
      nextDueDate: '2026-03-10',
      enabled: true,
    };
    await u
      .collection('recurring')
      .doc('ny')
      .set({...base, title: 'NY', timeZone: 'America/New_York'});
    await u
      .collection('recurring')
      .doc('tokyo')
      .set({...base, title: 'Tokyo', timeZone: 'Asia/Tokyo'});
    await u
      .collection('recurring')
      .doc('ending')
      .set({
        ...base,
        title: 'Ending',
        timeZone: 'UTC',
        startDate: '2026-03-10',
        nextDueDate: '2026-03-10',
        endDate: '2026-03-31',
      });

    // 2026-03-10 02:00 UTC is already March 10 in Tokyo, still March 9 in New York.
    const out = await runRecurring(deps(Date.UTC(2026, 2, 10, 2, 0, 0)));
    const ids = out.created.filter(id => id.includes('_2026-03-10')).sort();
    assert.deepEqual(ids, ['rec_ending_2026-03-10', 'rec_tokyo_2026-03-10']);
    assert.equal(
      (await u.collection('recurring').doc('ny').get()).get('nextDueDate'),
      '2026-03-10',
    );

    // April 10: the ending rule's next date is past its end, so it finishes without a new transaction.
    const april = await runRecurring(deps(Date.UTC(2026, 3, 10, 12, 0, 0)));
    const ending = await u.collection('recurring').doc('ending').get();
    assert.equal(ending.get('enabled'), false);
    assert.equal(ending.get('finished'), true);
    assert.ok(!april.created.some(id => id.startsWith('rec_ending_2026-04')));
    assert.ok(april.created.includes('rec_ny_2026-04-10'));
    // USD has two decimals: four charges of 9.99 (Tokyo and Ending in March, New York and Tokyo in April).
    assert.equal(Math.round((await u.get()).get('balance') * 100), -4 * 999);
  },
);

// ---- Savings goals: the array an old app writes is mirrored into users/{uid}/goals ------------
const goalUser = db.collection('users').doc('ug1');
const goalsOf = id => goalUser.collection('goals').doc(id);
const waitGone = async (ref, label, timeoutMs = 45000) => {
  const start = Date.now();
  for (;;) {
    if (!(await ref.get()).exists) return;
    if (Date.now() - start > timeoutMs)
      throw new Error(`timed out waiting for: ${label}`);
    await sleep(500);
  }
};
const oldGoal = (id, over = {}) => ({
  id,
  name: id === 'g1' ? 'Trip' : 'Phone',
  description: '',
  category: 'travel',
  targetDate: '',
  reminderEnabled: false,
  reminderFrequency: null,
  current: 100.5,
  target: 5000,
  monthly: 250,
  ...over,
});

await step(
  'goals: an old app writing the array creates the goal documents',
  async () => {
    await goalUser.set({
      name: 'Goal user',
      currency: 'INR',
      balance: 0,
      savingsGoals: [
        oldGoal('g1'),
        oldGoal('g2', {current: 0, target: 900, monthly: 0}),
      ],
    });
    const g1 = await waitFor(
      goalsOf('g1'),
      d => d.currentMinor !== undefined,
      'g1 mirrored',
    );
    await waitFor(
      goalsOf('g2'),
      d => d.targetMinor !== undefined,
      'g2 mirrored',
    );
    assert.equal(g1.get('name'), 'Trip');
    assert.equal(g1.get('current'), 100.5);
    assert.equal(g1.get('currentMinor'), 10050);
    assert.equal(g1.get('currency'), 'INR');
    assert.equal(g1.get('monthlyMinor'), 25000);
  },
);

await step('goals: an edit rewrites only the goal that changed', async () => {
  const g2Before = (await goalsOf('g2').get()).updateTime.toMillis();
  await goalUser.update({
    savingsGoals: [
      oldGoal('g1', {current: 200}),
      oldGoal('g2', {current: 0, target: 900, monthly: 0}),
    ],
  });
  await waitFor(
    goalsOf('g1'),
    d => d.current === 200 && d.currentMinor === 20000,
    'g1 edited',
  );
  await sleep(3000);
  assert.equal((await goalsOf('g2').get()).updateTime.toMillis(), g2Before);
});

await step(
  'goals: a goal an old app removes from the array loses its document',
  async () => {
    await goalUser.update({savingsGoals: [oldGoal('g1', {current: 200})]});
    await waitGone(goalsOf('g2'), 'g2 removed');
    assert.equal((await goalsOf('g1').get()).exists, true);
  },
);

await step(
  'goals: a document the new app created is not removed by an old app write that does not know it',
  async () => {
    // The new app writes the goal document and the array element in one transaction; here only the
    // document exists when the old app's whole-array write arrives.
    await goalsOf('g4').set({
      name: 'New app goal',
      current: 1,
      target: 10,
      monthly: 0,
      currency: 'INR',
    });
    await goalUser.update({savingsGoals: [oldGoal('g1', {current: 300})]});
    await waitFor(goalsOf('g1'), d => d.current === 300, 'g1 edited again');
    await sleep(3000);
    assert.equal((await goalsOf('g4').get()).exists, true);
  },
);

await step(
  'goals: the new app writing document and array together causes no rewrite, and unrelated user writes cost nothing',
  async () => {
    const entry = oldGoal('g5', {current: 7, target: 70, monthly: 1});
    const batch = db.batch();
    batch.set(goalsOf('g5'), {
      name: 'Trip',
      description: '',
      category: 'travel',
      targetDate: '',
      reminderEnabled: false,
      reminderFrequency: null,
      current: 7,
      target: 70,
      monthly: 1,
      currency: 'INR',
      currentMinor: 700,
      targetMinor: 7000,
      monthlyMinor: 100,
    });
    batch.update(goalUser, {
      savingsGoals: [oldGoal('g1', {current: 300}), entry],
    });
    await batch.commit();
    await sleep(4000);
    const g5Time = (await goalsOf('g5').get()).updateTime.toMillis();
    const g1Time = (await goalsOf('g1').get()).updateTime.toMillis();
    await goalUser.update({balance: 50});
    await goalUser.update({phone: '123'});
    await sleep(4000);
    assert.equal((await goalsOf('g5').get()).updateTime.toMillis(), g5Time);
    assert.equal((await goalsOf('g1').get()).updateTime.toMillis(), g1Time);
  },
);

// ---- Savings goal reached (flag enable_goal_reached is forced on by .env.demo-trackaexpense-functions) --
const reachedUser = db.collection('users').doc('ugr1');
const reachedGoal = reachedUser.collection('goals').doc('g1');
const reachedAlerts = async () =>
  (await reachedUser.collection('goalAlerts').get()).docs.map(d => d.data());
const goalDoc = (currentMinor, extra = {}) => ({
  name: 'Trip',
  currency: 'INR',
  currentMinor,
  targetMinor: 10000,
  ...extra,
});

await step('goal reached: no alert while below the target', async () => {
  await reachedUser.set({name: 'Reached user', currency: 'INR'});
  await reachedGoal.set(goalDoc(2000));
  await reachedGoal.update({currentMinor: 9999});
  await sleep(4000);
  assert.deepEqual(await reachedAlerts(), []);
});

await step('goal reached: crossing the target records one alert', async () => {
  await reachedGoal.update({currentMinor: 10000});
  const start = Date.now();
  while ((await reachedAlerts()).length === 0) {
    if (Date.now() - start > 45000)
      throw new Error('timed out waiting for the goal alert');
    await sleep(500);
  }
  const alerts = await reachedAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].goalId, 'g1');
  assert.equal(alerts[0].goalName, 'Trip');
  assert.equal(alerts[0].targetMinor, 10000);
  assert.equal(alerts[0].pushed, false); // no OneSignal key in the emulator
});

await step(
  'goal reached: edits of a goal that is already reached add nothing, a new fill after a withdrawal adds one',
  async () => {
    await reachedGoal.update({currentMinor: 15000});
    await reachedGoal.update({description: 'edited'});
    await sleep(4000);
    assert.equal((await reachedAlerts()).length, 1);

    await reachedGoal.update({currentMinor: 3000});
    await sleep(2000);
    await reachedGoal.update({currentMinor: 10000});
    const start = Date.now();
    while ((await reachedAlerts()).length < 2) {
      if (Date.now() - start > 45000)
        throw new Error('timed out waiting for the second alert');
      await sleep(500);
    }
    assert.equal((await reachedAlerts()).length, 2);
  },
);

await step(
  'goal reached: core sends one push, and a redelivered event adds nothing',
  async () => {
    const {notifyGoalReached} = require('../lib/goalReached.js');
    const sent = [];
    const deps = {
      db,
      apiKey: 'test-key',
      appId: 'app',
      fetchFn: async (_url, init) => {
        sent.push(JSON.parse(init.body));
        return {ok: true, json: async () => ({id: `n${sent.length}`})};
      },
    };
    const goal = {
      name: 'Laptop',
      currency: 'INR',
      currentMinor: 90000,
      targetMinor: 90000,
    };
    const first = await notifyGoalReached(deps, 'ugr2', 'gx', goal, 'event-1');
    assert.equal(first, 'pushed');
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].include_aliases.external_id, ['ugr2']);
    assert.equal(sent[0].data.type, 'goal_reached');
    assert.equal(sent[0].data.goalId, 'gx');
    assert.match(sent[0].contents.en, /"Laptop"/);
    const alert = await db.doc('users/ugr2/goalAlerts/event-1').get();
    assert.equal(alert.get('pushed'), true);

    // The same event delivered again, even by overlapping runs, sends nothing more.
    const again = await Promise.all(
      [1, 2, 3].map(() =>
        notifyGoalReached(deps, 'ugr2', 'gx', goal, 'event-1'),
      ),
    );
    assert.deepEqual(again, ['duplicate', 'duplicate', 'duplicate']);
    assert.equal(sent.length, 1);

    // A different event for the same goal is a new alert.
    assert.equal(
      await notifyGoalReached(deps, 'ugr2', 'gx', goal, 'event-2'),
      'pushed',
    );
    assert.equal(sent.length, 2);
  },
);

await step(
  'weekly summary: sends once on Sunday 9 AM in the user zone, skips other hours and quiet weeks',
  async () => {
    const {runWeekly} = require('../lib/weeklyJob.js');
    const sent = [];
    const deps = nowMs => ({
      db,
      apiKey: 'test-key',
      appId: 'app',
      fetchFn: async (_url, init) => {
        sent.push(JSON.parse(init.body));
        return {ok: true, json: async () => ({id: `w${sent.length}`})};
      },
      now: () => nowMs,
    });
    const busy = db.collection('users').doc('uw1');
    await busy.set({name: 'Busy', currency: 'INR'});
    const mk = (id, type, amountMinor, dateISO, category) =>
      busy
        .collection('transactions')
        .doc(id)
        .set({type, amountMinor, dateISO, category, currency: 'INR'});
    await mk('a', 'expense', 150000, '2026-11-17', 'Food');
    await mk('b', 'expense', 50050, '2026-11-20', 'Fuel');
    await mk('c', 'income', 900000, '2026-11-18', 'Salary');
    await mk('old', 'expense', 999999, '2026-11-10', 'Food');
    await db
      .collection('users')
      .doc('uw2')
      .set({name: 'Quiet', currency: 'INR'});
    // A user in New York: not their Sunday 9 AM at the India moment.
    await db
      .collection('users')
      .doc('uw3')
      .set({name: 'Away', currency: 'INR', timeZone: 'America/New_York'});

    // Saturday in India: nothing.
    const sat = await runWeekly(deps(Date.UTC(2026, 10, 21, 3, 30)));
    assert.deepEqual(sat.created, []);

    // Sunday 09:00 in India.
    const sunday = Date.UTC(2026, 10, 22, 3, 30);
    const first = await runWeekly(deps(sunday));
    assert.ok(first.created.includes('users/uw1/weeklyAlerts/2026-11-22'));
    assert.ok(first.created.includes('users/uw2/weeklyAlerts/2026-11-22'));
    assert.ok(!first.created.some(p => p.startsWith('users/uw3/')));
    assert.equal(first.failed, 0);
    const toBusy = sent.filter(m => m.include_aliases.external_id[0] === 'uw1');
    assert.equal(toBusy.length, 1);
    assert.equal(toBusy[0].data.type, 'weekly_summary');
    assert.match(toBusy[0].contents.en, /2000\.50 INR/);
    assert.match(toBusy[0].contents.en, /Food/);
    assert.equal(
      sent.some(m => m.include_aliases.external_id[0] === 'uw2'),
      false,
    );
    assert.equal(
      (await busy.collection('weeklyAlerts').doc('2026-11-22').get()).get(
        'pushed',
      ),
      true,
    );

    // The same moment again and overlapping runs: no second push.
    const before = sent.length;
    await Promise.all([1, 2, 3].map(() => runWeekly(deps(sunday))));
    assert.equal(sent.length, before);

    // Sunday 09:00 in New York is 14:00 UTC: that user gets theirs, the others do not repeat.
    const ny = await runWeekly(deps(Date.UTC(2026, 10, 22, 14, 0)));
    assert.deepEqual(ny.created, ['users/uw3/weeklyAlerts/2026-11-22']);
  },
);

const recorder = () => {
  const sent = [];
  const deps = nowMs => ({
    db,
    apiKey: 'test-key',
    appId: 'app',
    fetchFn: async (_url, init) => {
      sent.push(JSON.parse(init.body));
      return {ok: true, json: async () => ({id: `m${sent.length}`})};
    },
    now: () => nowMs,
  });
  return {sent, deps};
};

await step(
  'monthly summary: sends last month once on the 1st at 9 AM local',
  async () => {
    const {runMonthly} = require('../lib/weeklyJob.js');
    const {sent, deps} = recorder();
    const u = db.collection('users').doc('um1');
    await u.set({name: 'Monthly', currency: 'INR'});
    await u.collection('transactions').doc('t1').set({
      type: 'expense',
      amountMinor: 123450,
      dateISO: '2026-11-05',
      category: 'Rent',
      currency: 'INR',
    });
    const first = Date.UTC(2026, 11, 1, 3, 30);
    const run = await runMonthly(deps(first));
    assert.ok(run.created.includes('users/um1/monthlyAlerts/2026-11'));
    const mine = sent.filter(m => m.include_aliases.external_id[0] === 'um1');
    assert.equal(mine.length, 1);
    assert.equal(mine[0].data.type, 'monthly_summary');
    assert.match(mine[0].contents.en, /1234\.50 INR/);
    await runMonthly(deps(first));
    assert.equal(
      sent.filter(m => m.include_aliases.external_id[0] === 'um1').length,
      1,
    );
  },
);

await step(
  'settle reminders: one push to a debtor on Sunday 10 AM, then a 13 day cooldown',
  async () => {
    const {runSettleReminders} = require('../lib/settleJob.js');
    const {sent, deps} = recorder();
    await db
      .collection('users')
      .doc('us-a')
      .set({name: 'Lender', email: 'lender@example.com', currency: 'INR'});
    await db
      .collection('users')
      .doc('us-b')
      .set({name: 'Debtor', email: 'Debtor@example.com', currency: 'INR'});
    const group = db.collection('groups').doc('gs1');
    await group.set({name: 'Trip', members: ['lender@example.com']});
    await group
      .collection('splits')
      .doc('s1')
      .set({
        paidBy: {email: 'lender@example.com'},
        splitUsers: [
          {email: 'lender@example.com'},
          {email: 'debtor@example.com'},
        ],
        amountMinor: 50000,
        currency: 'INR',
      });
    // Sunday 2026-11-22, 10:00 in India is 04:30 UTC.
    const sunday = Date.UTC(2026, 10, 22, 4, 30);
    const first = await runSettleReminders(deps(sunday));
    // Other fixture users from earlier steps may owe money too, so look at this debtor only.
    const toDebtor = () =>
      sent.filter(m => m.include_aliases.external_id[0] === 'us-b');
    assert.ok(first.reminded.includes('us-b'));
    assert.ok(!first.reminded.includes('us-a'));
    assert.equal(toDebtor().length, 1);
    assert.equal(toDebtor()[0].data.type, 'settlement_reminder');
    assert.match(toDebtor()[0].contents.en, /250\.00 INR/);

    await Promise.all([1, 2, 3].map(() => runSettleReminders(deps(sunday))));
    assert.equal(toDebtor().length, 1);

    // A week later: still inside the 13 day cooldown. Two weeks later: sent again.
    const week = await runSettleReminders(deps(sunday + 7 * 86_400_000));
    assert.ok(!week.reminded.includes('us-b'));
    const two = await runSettleReminders(deps(sunday + 14 * 86_400_000));
    assert.ok(two.reminded.includes('us-b'));

    // Wrong hour: nothing.
    const wrong = await runSettleReminders(
      deps(sunday + 28 * 86_400_000 + 3_600_000),
    );
    assert.deepEqual(wrong.reminded, []);
  },
);

await step(
  'fun nudge: one push in the chosen local hour, praise when active today',
  async () => {
    const {runFun} = require('../lib/funJob.js');
    const {funHourFor} = require('../lib/fun.js');
    const {sent, deps} = recorder();
    const u = db.collection('users').doc('uf1');
    await u.set({name: 'Fun', currency: 'INR'});
    await u
      .collection('transactions')
      .doc('t1')
      .set({type: 'expense', amountMinor: 100, dateISO: '2026-11-18'});
    const hour = funHourFor('uf1', '2026-11-18');
    // Local hour h at :30 in India is (h - 6) UTC at :00.
    const due = Date.UTC(2026, 10, 18, hour - 6, 0);
    const out = await runFun(deps(due + 30 * 60_000));
    assert.ok(out.sent.includes('uf1'));
    const mine = sent.filter(m => m.include_aliases.external_id[0] === 'uf1');
    assert.equal(mine.length, 1);
    assert.equal(mine[0].data.context, 'motivational');
    await runFun(deps(due + 30 * 60_000));
    assert.equal(
      sent.filter(m => m.include_aliases.external_id[0] === 'uf1').length,
      1,
    );

    // Opted out (funNudgeEnabled false): nothing is sent and no marker is written, even in their
    // chosen hour. A person who switched it on explicitly still gets it.
    const off = db.collection('users').doc('uf2');
    await off.set({name: 'Quiet', currency: 'INR', funNudgeEnabled: false});
    const on = db.collection('users').doc('uf3');
    await on.set({name: 'Loud', currency: 'INR', funNudgeEnabled: true});
    for (const uid of ['uf2', 'uf3']) {
      const h = funHourFor(uid, '2026-11-18');
      const at = Date.UTC(2026, 10, 18, h - 6, 0) + 30 * 60_000;
      const run = await runFun(deps(at));
      assert.equal(run.sent.includes('uf2'), false);
    }
    const toUid = uid =>
      sent.filter(m => m.include_aliases.external_id[0] === uid).length;
    assert.equal(toUid('uf2'), 0);
    assert.equal(toUid('uf3'), 1);
    const marker = await off
      .collection('reminderLogs')
      .doc('fun_2026-11-18')
      .get();
    assert.equal(marker.exists, false);
  },
);

await step(
  'receipt scan: reads the caller own image once per allowance, and enforces both limits',
  async () => {
    const {
      scanReceipt,
      DAILY_LIMIT_PER_USER,
      MONTHLY_LIMIT_ALL,
    } = require('../lib/receipt.js');
    let recognized = 0;
    const deps = (nowMs, over = {}) => ({
      db,
      statImage: async () => ({size: 1000, contentType: 'image/jpeg'}),
      readImage: async () => Buffer.from('x'),
      recognize: async () => {
        recognized += 1;
        return 'CHAI POINT\nDate 14/11/2026\nTOTAL 120.00';
      },
      now: () => nowMs,
      ...over,
    });
    const t0 = Date.UTC(2026, 10, 18, 6, 0);
    const input = {storagePath: 'bills/usc1/r.jpg'};
    const guess = await scanReceipt(deps(t0), 'usc1', input);
    assert.deepEqual(guess, {
      amounts: ['120.00'],
      date: '2026-11-14',
      merchant: 'CHAI POINT',
    });
    assert.equal(
      (await db.collection('scanLimits').doc('usc1').get()).get('count'),
      1,
    );
    assert.equal(
      (await db.collection('scanLimits').doc('_month_2026-11').get()).get(
        'count',
      ),
      1,
    );

    const code = async p => {
      try {
        await p;
        return 'ok';
      } catch (e) {
        return e.code;
      }
    };
    // Someone else's file, a missing file and a non-image spend nothing.
    assert.equal(
      await code(
        scanReceipt(deps(t0), 'usc1', {storagePath: 'bills/other/r.jpg'}),
      ),
      'permission-denied',
    );
    assert.equal(
      await code(
        scanReceipt(deps(t0, {statImage: async () => null}), 'usc1', input),
      ),
      'not-found',
    );
    assert.equal(
      await code(
        scanReceipt(
          deps(t0, {
            statImage: async () => ({size: 10, contentType: 'application/pdf'}),
          }),
          'usc1',
          input,
        ),
      ),
      'invalid-argument',
    );
    assert.equal(
      await code(
        scanReceipt(
          deps(t0, {
            statImage: async () => ({
              size: 11 * 1024 * 1024,
              contentType: 'image/png',
            }),
          }),
          'usc1',
          input,
        ),
      ),
      'invalid-argument',
    );
    assert.equal(
      (await db.collection('scanLimits').doc('usc1').get()).get('count'),
      1,
    );

    // Daily limit for one person, then a fresh window after 24 hours.
    for (let i = 1; i < DAILY_LIMIT_PER_USER; i += 1) {
      await scanReceipt(deps(t0), 'usc1', input);
    }
    assert.equal(
      await code(scanReceipt(deps(t0), 'usc1', input)),
      'resource-exhausted',
    );
    assert.equal(
      await code(scanReceipt(deps(t0 + 86_400_000), 'usc1', input)),
      'ok',
    );

    // A failed recognition is reported as unavailable.
    assert.equal(
      await code(
        scanReceipt(
          deps(t0, {
            recognize: async () => {
              throw new Error('boom');
            },
          }),
          'usc2',
          {storagePath: 'bills/usc2/r.jpg'},
        ),
      ),
      'unavailable',
    );

    // The monthly cap for the whole app stops everyone.
    await db
      .collection('scanLimits')
      .doc('_month_2026-12')
      .set({count: MONTHLY_LIMIT_ALL});
    const dec = Date.UTC(2026, 11, 3, 6, 0);
    const before = recognized;
    assert.equal(
      await code(
        scanReceipt(deps(dec), 'usc3', {storagePath: 'bills/usc3/r.jpg'}),
      ),
      'resource-exhausted',
    );
    assert.equal(recognized, before);
  },
);

console.log(`\n${passed} integration checks passed`);
process.exit(0);
