// Integration test of the recordSettlement and deleteSettlement callables: real Auth, Firestore
// and Functions emulators, real ID tokens.
//
// Run: yarn test:settlement   (needs JDK 21 or newer; demo project, no live project is touched).
import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore, Timestamp} from 'firebase-admin/firestore';

const project = process.env.GCLOUD_PROJECT || 'demo-trackaexpense-settlement';
initializeApp({projectId: project});
const db = getFirestore();
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const authCall = async (path, body) => {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/${path}?key=fake`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...body, returnSecureToken: true}),
    },
  );
  return response.json();
};

const makeUser = async (email, profile) => {
  const {idToken, localId} = await authCall('accounts:signUp', {
    email,
    password: 'not-a-real-password',
  });
  await db
    .collection('users')
    .doc(localId)
    .set({email, balance: 0, currency: 'INR', ...profile});
  return {uid: localId, idToken, email};
};

const call = async (name, data, idToken) => {
  const response = await fetch(
    `http://127.0.0.1:5001/${project}/asia-south1/${name}`,
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

const balanceOf = async uid =>
  (await db.doc(`users/${uid}`).get()).get('balance');
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

const alice = await makeUser('alice@example.com', {name: 'Alice'});
const bob = await makeUser('bob@example.com', {name: 'Bob'});
const carol = await makeUser('carol@example.com', {name: 'Carol'});
const dave = await makeUser('dave@example.com', {name: 'Dave'});
await db.doc('groups/g1').set({
  name: 'Trip',
  createdBy: alice.uid,
  members: [alice.email, bob.email, carol.email],
  pendingInvites: [],
});
await db.doc(`users/${alice.uid}`).update({balance: 10});

const record = (user, overrides = {}) =>
  call(
    'recordSettlement',
    {
      groupId: 'g1',
      fromEmail: alice.email,
      toEmail: bob.email,
      amount: '100.456',
      note: 'Dinner',
      includeInTransactions: true,
      requestId: 'req-aaaaaaaa-1',
      ...overrides,
    },
    user.idToken,
  );

await step('signed-out callers are refused', async () => {
  const {status, body} = await call('recordSettlement', {}, null);
  assert.equal(status, 401);
  assert.equal(body.error.status, 'UNAUTHENTICATED');
  assert.equal((await call('deleteSettlement', {}, null)).status, 401);
});

await step(
  'record: documents, both balances and both transactions in one go',
  async () => {
    const {status, body} = await record(alice);
    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(body.result, {
      settlementId: 'req-aaaaaaaa-1',
      splitId: 'req-aaaaaaaa-1',
      alreadyRecorded: false,
    });
    const settlement = (
      await db.doc('groups/g1/settlements/req-aaaaaaaa-1').get()
    ).data();
    assert.equal(settlement.amountMinor, 10046);
    assert.equal(settlement.amount, 100.46);
    assert.equal(settlement.currency, 'INR');
    assert.equal(settlement.from.userId, alice.uid);
    assert.equal(settlement.to.userId, bob.uid);
    assert.equal(settlement.status, 'completed');

    const split = (
      await db.doc('groups/g1/splits/req-aaaaaaaa-1').get()
    ).data();
    assert.equal(split.type, 'settlement');
    assert.equal(split.isSettlement, true);
    assert.equal(split.paidBy.email, alice.email);
    assert.equal(split.splitUsers[0].email, bob.email);
    assert.equal(split.settlementId, 'req-aaaaaaaa-1');

    near(await balanceOf(alice.uid), 10 - 100.46);
    near(await balanceOf(bob.uid), 100.46);

    const aliceTx = (
      await db.doc(`users/${alice.uid}/transactions/req-aaaaaaaa-1`).get()
    ).data();
    assert.equal(aliceTx.type, 'expense');
    assert.equal(aliceTx.splitRole, 'settlement_payer');
    assert.equal(aliceTx.splitId, 'req-aaaaaaaa-1');
    assert.equal(aliceTx.amount, '100.46');
    const bobTx = (
      await db.doc(`users/${bob.uid}/transactions/req-aaaaaaaa-1`).get()
    ).data();
    assert.equal(bobTx.type, 'income');
    assert.equal(bobTx.splitRole, 'settlement_receiver');
  },
);

await step(
  'record: a retry with the same requestId changes nothing',
  async () => {
    const {status, body} = await record(alice);
    assert.equal(status, 200);
    assert.equal(body.result.alreadyRecorded, true);
    near(await balanceOf(alice.uid), 10 - 100.46);
    near(await balanceOf(bob.uid), 100.46);
  },
);

await step(
  'record: the caller can choose to leave their own transaction out',
  async () => {
    const {status} = await record(carol, {
      fromEmail: alice.email,
      toEmail: carol.email,
      amount: 25,
      includeInTransactions: false,
      requestId: 'req-bbbbbbbb-2',
    });
    assert.equal(status, 200);
    assert.equal(
      (await db.doc(`users/${carol.uid}/transactions/req-bbbbbbbb-2`).get())
        .exists,
      false,
    );
    const aliceTx = (
      await db.doc(`users/${alice.uid}/transactions/req-bbbbbbbb-2`).get()
    ).data();
    assert.equal(aliceTx.type, 'expense');
    // Carol receives 25 from Alice.
    near(await balanceOf(carol.uid), 25);
    near(await balanceOf(alice.uid), 10 - 100.46 - 25);
  },
);

await step(
  'record: outsiders, non-members, bad amounts and bad ids are refused',
  async () => {
    const before = [await balanceOf(alice.uid), await balanceOf(bob.uid)];
    const outsider = await record(dave, {requestId: 'req-cccccccc-3'});
    assert.equal(outsider.status, 403);
    const nonMemberCounterparty = await record(alice, {
      toEmail: dave.email,
      requestId: 'req-dddddddd-4',
    });
    assert.equal(nonMemberCounterparty.status, 400);
    const self = await record(alice, {
      toEmail: alice.email,
      requestId: 'req-eeeeeeee-5',
    });
    assert.equal(self.status, 400);
    for (const amount of ['0', '-5', 'abc', '1000000000', '1e9', null]) {
      const bad = await record(alice, {amount, requestId: 'req-ffffffff-6'});
      assert.equal(bad.status, 400, `amount ${amount}`);
    }
    const badId = await record(alice, {requestId: 'x/y'});
    assert.equal(badId.status, 400);
    const noGroup = await record(alice, {
      groupId: 'missing',
      requestId: 'req-gggggggg-7',
    });
    assert.equal(noGroup.status, 404);
    assert.deepEqual(
      [await balanceOf(alice.uid), await balanceOf(bob.uid)],
      before,
    );
    assert.equal(
      (await db.doc('groups/g1/settlements/req-cccccccc-3').get()).exists,
      false,
    );
  },
);

await step(
  'record: only the two people or the group creator may record; the creator gets no entry',
  async () => {
    // Bob is a member but neither side of an Alice to Carol payment, and not the creator.
    const notParty = await record(bob, {
      fromEmail: alice.email,
      toEmail: carol.email,
      requestId: 'req-hhhhhhhh-8',
    });
    assert.equal(notParty.status, 403);
    // Alice created the group: she may record a payment from Bob to Carol.
    const [bobBefore, carolBefore, aliceBefore] = [
      await balanceOf(bob.uid),
      await balanceOf(carol.uid),
      await balanceOf(alice.uid),
    ];
    const byCreator = await record(alice, {
      fromEmail: bob.email,
      toEmail: carol.email,
      amount: 10,
      requestId: 'req-iiiiiiii-9',
    });
    assert.equal(byCreator.status, 200, JSON.stringify(byCreator.body));
    near(await balanceOf(bob.uid), bobBefore - 10);
    near(await balanceOf(carol.uid), carolBefore + 10);
    near(await balanceOf(alice.uid), aliceBefore);
    assert.equal(
      (await db.doc(`users/${alice.uid}/transactions/req-iiiiiiii-9`).get())
        .exists,
      false,
    );
    assert.equal(
      (await db.doc(`users/${bob.uid}/transactions/req-iiiiiiii-9`).get()).get(
        'type',
      ),
      'expense',
    );
    assert.equal(
      (
        await db.doc(`users/${carol.uid}/transactions/req-iiiiiiii-9`).get()
      ).get('type'),
      'income',
    );
    // Undo it so the balances in the later steps are unchanged.
    const undone = await call(
      'deleteSettlement',
      {groupId: 'g1', splitId: 'req-iiiiiiii-9'},
      alice.idToken,
    );
    assert.equal(undone.status, 200);
    near(await balanceOf(bob.uid), bobBefore);
    near(await balanceOf(carol.uid), carolBefore);
  },
);

await step(
  'delete: only the people involved or the group creator may delete',
  async () => {
    const outsider = await call(
      'deleteSettlement',
      {groupId: 'g1', splitId: 'req-aaaaaaaa-1'},
      carol.idToken,
    );
    assert.equal(outsider.status, 403);
    assert.equal(
      (await db.doc('groups/g1/splits/req-aaaaaaaa-1').get()).exists,
      true,
    );
    const notSettlement = await (async () => {
      await db.doc('groups/g1/splits/normal1').set({type: 'equal', amount: 5});
      return call(
        'deleteSettlement',
        {groupId: 'g1', splitId: 'normal1'},
        alice.idToken,
      );
    })();
    assert.equal(notSettlement.status, 400);
  },
);

await step(
  'delete: reverses both balances and removes every linked document',
  async () => {
    const {status, body} = await call(
      'deleteSettlement',
      {groupId: 'g1', splitId: 'req-aaaaaaaa-1'},
      bob.idToken,
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(body.result, {deleted: true, settlementRemoved: true});
    assert.equal(
      (await db.doc('groups/g1/splits/req-aaaaaaaa-1').get()).exists,
      false,
    );
    assert.equal(
      (await db.doc('groups/g1/settlements/req-aaaaaaaa-1').get()).exists,
      false,
    );
    assert.equal(
      (await db.doc(`users/${alice.uid}/transactions/req-aaaaaaaa-1`).get())
        .exists,
      false,
    );
    assert.equal(
      (await db.doc(`users/${bob.uid}/transactions/req-aaaaaaaa-1`).get())
        .exists,
      false,
    );
    near(await balanceOf(bob.uid), 0);
    near(await balanceOf(alice.uid), 10 - 25);
    // The other settlement is untouched.
    assert.equal(
      (await db.doc('groups/g1/splits/req-bbbbbbbb-2').get()).exists,
      true,
    );
  },
);

await step('delete: deleting again is harmless', async () => {
  const {status, body} = await call(
    'deleteSettlement',
    {groupId: 'g1', splitId: 'req-aaaaaaaa-1'},
    alice.idToken,
  );
  assert.equal(status, 200);
  assert.equal(body.result.deleted, false);
  near(await balanceOf(bob.uid), 0);
});

await step(
  'delete: a settlement made by an old app (no link, no userId) is reversed too',
  async () => {
    const created = Timestamp.fromMillis(1_700_000_000_000);
    const from = {email: bob.email, name: 'Bob'};
    const to = {email: carol.email, name: 'Carol'};
    await db.doc('groups/g1/settlements/oldSettlement').set({
      from,
      to,
      amount: 40,
      currency: 'INR',
      status: 'completed',
      createdAt: created,
      groupId: 'g1',
    });
    await db.doc('groups/g1/splits/oldSplit').set({
      title: 'Settlement Payment',
      amount: 40,
      category: 'Settlement',
      paidBy: from,
      splitUsers: [to],
      date: created,
      createdAt: created,
      type: 'settlement',
      isSettlement: true,
      settlement: {from, to, amount: 40},
    });
    await db.doc(`users/${bob.uid}/transactions/oldTx`).set({
      type: 'expense',
      amount: '40',
      splitId: 'oldSplit',
      source: 'split',
    });
    await db.doc(`users/${bob.uid}`).update({balance: -40});
    await db.doc(`users/${carol.uid}`).update({balance: 65});

    const {status, body} = await call(
      'deleteSettlement',
      {groupId: 'g1', splitId: 'oldSplit'},
      carol.idToken,
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(body.result, {deleted: true, settlementRemoved: true});
    near(await balanceOf(bob.uid), 0);
    near(await balanceOf(carol.uid), 25);
    assert.equal(
      (await db.doc(`users/${bob.uid}/transactions/oldTx`).get()).exists,
      false,
    );
    assert.equal(
      (await db.doc('groups/g1/settlements/oldSettlement').get()).exists,
      false,
    );
  },
);

await step(
  'a card repayment keeps the borrower balance, and deleting it gives nothing back',
  async () => {
    await db.doc(`users/${alice.uid}/cards/card1`).set({
      name: 'HDFC',
      statementDay: 15,
      currency: 'INR',
    });
    const aliceBefore = await balanceOf(alice.uid);
    const bobBefore = await balanceOf(bob.uid);
    const {status, body} = await record(alice, {
      requestId: 'req-card-aaaa-1',
      amount: '40',
      cardId: 'card1',
    });
    assert.equal(status, 200, JSON.stringify(body));
    near(await balanceOf(alice.uid), aliceBefore);
    near(await balanceOf(bob.uid), bobBefore + 40);
    const aliceTx = (
      await db.doc(`users/${alice.uid}/transactions/req-card-aaaa-1`).get()
    ).data();
    assert.equal(aliceTx.cardId, 'card1');
    const bobTx = (
      await db.doc(`users/${bob.uid}/transactions/req-card-aaaa-1`).get()
    ).data();
    assert.equal(bobTx.cardId, undefined);
    assert.equal(
      (await db.doc('groups/g1/splits/req-card-aaaa-1').get()).get(
        'payerCardId',
      ),
      'card1',
    );

    const gone = await call(
      'deleteSettlement',
      {groupId: 'g1', splitId: 'req-card-aaaa-1'},
      alice.idToken,
    );
    assert.equal(gone.status, 200, JSON.stringify(gone.body));
    near(await balanceOf(alice.uid), aliceBefore);
    near(await balanceOf(bob.uid), bobBefore);
  },
);

await step(
  'a card is ignored for the receiver or without a transaction, and an unknown card is refused',
  async () => {
    const bobBefore = await balanceOf(bob.uid);
    const aliceBefore = await balanceOf(alice.uid);
    // The receiver chose a card: it does not apply, balances move as usual.
    await db.doc(`users/${bob.uid}/cards/bobcard`).set({
      name: 'Axis',
      statementDay: 5,
      currency: 'INR',
    });
    const asReceiver = await record(bob, {
      requestId: 'req-card-bbbb-2',
      amount: '10',
      cardId: 'bobcard',
    });
    assert.equal(asReceiver.status, 200, JSON.stringify(asReceiver.body));
    near(await balanceOf(alice.uid), aliceBefore - 10);
    near(await balanceOf(bob.uid), bobBefore + 10);
    // Not added to transactions: the card is ignored and the balance drops as usual.
    const noTx = await record(alice, {
      requestId: 'req-card-cccc-3',
      amount: '5',
      cardId: 'card1',
      includeInTransactions: false,
    });
    assert.equal(noTx.status, 200, JSON.stringify(noTx.body));
    near(await balanceOf(alice.uid), aliceBefore - 15);
    // A card that does not exist is an error.
    const unknown = await record(alice, {
      requestId: 'req-card-dddd-4',
      amount: '5',
      cardId: 'nope',
    });
    assert.equal(unknown.status, 400);
  },
);

console.log(`\n${passed} settlement checks passed`);
process.exit(0);
