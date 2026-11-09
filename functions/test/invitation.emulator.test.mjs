// Integration test of the respondToInvitation callable: real Auth, Firestore and Functions
// emulators, real ID tokens.
//
// Run: yarn test:invitation   (needs JDK 21 or newer; demo project, no live project is touched).
import assert from 'node:assert/strict';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

const project = process.env.GCLOUD_PROJECT || 'demo-trackaexpense-invitation';
initializeApp({projectId: project});
const db = getFirestore();
const adminAuth = getAuth();
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

// Signs up, optionally marks the email verified, then signs in again so the token carries it.
const makeUser = async (email, {verified, name}) => {
  const {localId} = await authCall('accounts:signUp', {
    email,
    password: 'not-a-real-password',
  });
  if (verified) {
    await adminAuth.updateUser(localId, {emailVerified: true});
  }
  const {idToken} = await authCall('accounts:signInWithPassword', {
    email,
    password: 'not-a-real-password',
  });
  await db.collection('users').doc(localId).set({email, name});
  return {uid: localId, idToken, email};
};

const call = async (data, idToken) => {
  const response = await fetch(
    `http://127.0.0.1:5001/${project}/asia-south1/respondToInvitation`,
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

const alice = await makeUser('alice@example.com', {
  verified: true,
  name: 'Alice',
});
const bob = await makeUser('bob@example.com', {verified: true, name: 'Bob'});
const carol = await makeUser('carol@example.com', {
  verified: false,
  name: 'Carol',
});
const dave = await makeUser('dave@example.com', {verified: true, name: 'Dave'});

await db.doc('groups/g1').set({
  name: 'Trip',
  createdBy: alice.uid,
  members: [alice.email],
  memberNames: {[alice.email]: 'Alice'},
  pendingInvites: ['Bob@Example.com', carol.email, dave.email],
});
const invite = (id, email, extra = {}) =>
  db.doc(`invitations/${id}`).set({
    email,
    groupId: 'g1',
    groupName: 'Trip',
    inviterUid: alice.uid,
    inviterEmail: alice.email,
    status: 'pending',
    ...extra,
  });
await invite('inv-bob', 'Bob@Example.com');
await invite('inv-carol', carol.email);
await invite('inv-dave', dave.email);

await step('signed-out callers are refused', async () => {
  const {status, body} = await call(
    {invitationId: 'inv-bob', accept: true},
    null,
  );
  assert.equal(status, 401);
  assert.equal(body.error.status, 'UNAUTHENTICATED');
});

await step('bad input is rejected', async () => {
  for (const data of [
    null,
    {},
    {invitationId: 'inv-bob'},
    {invitationId: 'a/b', accept: true},
    {invitationId: 'inv-bob', accept: 'yes'},
  ]) {
    const {status} = await call(data, bob.idToken);
    assert.equal(status, 400, JSON.stringify(data));
  }
});

await step(
  'an unverified email cannot answer, even for its own invitation',
  async () => {
    const {status} = await call(
      {invitationId: 'inv-carol', accept: true},
      carol.idToken,
    );
    assert.equal(status, 403);
    assert.equal(
      (await db.doc('invitations/inv-carol').get()).get('status'),
      'pending',
    );
  },
);

await step(
  'someone else cannot answer an invitation not addressed to them',
  async () => {
    const {status} = await call(
      {invitationId: 'inv-bob', accept: true},
      dave.idToken,
    );
    assert.equal(status, 403);
    // Setting the profile email to the victim's address does not help: the token decides.
    await db.doc(`users/${dave.uid}`).update({email: 'Bob@Example.com'});
    const again = await call(
      {invitationId: 'inv-bob', accept: true},
      dave.idToken,
    );
    assert.equal(again.status, 403);
    const group = (await db.doc('groups/g1').get()).data();
    assert.deepEqual(group.members, [alice.email]);
    await db.doc(`users/${dave.uid}`).update({email: dave.email});
  },
);

await step(
  'accept: joins the group, leaves the pending list, closes the invitation',
  async () => {
    const {status, body} = await call(
      {invitationId: 'inv-bob', accept: true},
      bob.idToken,
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(body.result, {status: 'accepted', alreadyDone: false});
    const group = (await db.doc('groups/g1').get()).data();
    assert.deepEqual(group.members, [alice.email, bob.email]);
    assert.equal(group.memberNames[bob.email], 'Bob');
    assert.equal(group.memberNames[alice.email], 'Alice');
    assert.deepEqual(group.pendingInvites, [carol.email, dave.email]);
    const inv = (await db.doc('invitations/inv-bob').get()).data();
    assert.equal(inv.status, 'accepted');
    assert.ok(inv.respondedAt);
    // The memberIds trigger picks the new member up.
    for (let i = 0; i < 60; i += 1) {
      const ids = (await db.doc('groups/g1').get()).get('memberIds') ?? [];
      if (ids.includes(bob.uid)) break;
      await sleep(500);
    }
    assert.ok(
      ((await db.doc('groups/g1').get()).get('memberIds') ?? []).includes(
        bob.uid,
      ),
    );
  },
);

await step('accept again is harmless and adds nothing twice', async () => {
  const {status, body} = await call(
    {invitationId: 'inv-bob', accept: true},
    bob.idToken,
  );
  assert.equal(status, 200);
  assert.equal(body.result.alreadyDone, true);
  assert.deepEqual((await db.doc('groups/g1').get()).get('members'), [
    alice.email,
    bob.email,
  ]);
  // Declining an accepted invitation is refused.
  const decline = await call(
    {invitationId: 'inv-bob', accept: false},
    bob.idToken,
  );
  assert.equal(decline.status, 400);
  assert.equal(decline.body.error.status, 'FAILED_PRECONDITION');
});

await step(
  'decline: leaves the pending list, does not join, closes the invitation',
  async () => {
    const {status, body} = await call(
      {invitationId: 'inv-dave', accept: false},
      dave.idToken,
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.deepEqual(body.result, {status: 'declined', alreadyDone: false});
    const group = (await db.doc('groups/g1').get()).data();
    assert.deepEqual(group.members, [alice.email, bob.email]);
    assert.deepEqual(group.pendingInvites, [carol.email]);
    assert.equal(
      (await db.doc('invitations/inv-dave').get()).get('status'),
      'declined',
    );
    const accept = await call(
      {invitationId: 'inv-dave', accept: true},
      dave.idToken,
    );
    assert.equal(accept.status, 400);
    assert.deepEqual((await db.doc('groups/g1').get()).get('members'), [
      alice.email,
      bob.email,
    ]);
  },
);

await step(
  'a deleted group: accept is refused, decline still closes the invitation',
  async () => {
    await db.doc('groups/gone').set({name: 'Old', members: [alice.email]});
    await invite('inv-gone-accept', bob.email, {groupId: 'gone'});
    await invite('inv-gone-decline', bob.email, {groupId: 'gone'});
    await db.doc('groups/gone').delete();
    const accept = await call(
      {invitationId: 'inv-gone-accept', accept: true},
      bob.idToken,
    );
    assert.equal(accept.status, 400);
    assert.equal(accept.body.error.status, 'FAILED_PRECONDITION');
    const decline = await call(
      {invitationId: 'inv-gone-decline', accept: false},
      bob.idToken,
    );
    assert.equal(decline.status, 200);
    assert.equal(
      (await db.doc('invitations/inv-gone-decline').get()).get('status'),
      'declined',
    );
  },
);

await step('an unknown invitation is not found', async () => {
  const {status} = await call(
    {invitationId: 'nope', accept: true},
    bob.idToken,
  );
  assert.equal(status, 404);
});

console.log(`\n${passed} invitation checks passed`);
process.exit(0);
