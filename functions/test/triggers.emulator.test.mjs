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

console.log(`\n${passed} integration checks passed`);
process.exit(0);
