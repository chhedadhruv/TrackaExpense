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

// ---- Invite links: createGroupInviteLink, previewGroupInviteLink, joinGroupByLink, revoke ------
const callFn = async (name, data, idToken) => {
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
const sha256 = async text =>
  Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  ).toString('hex');

const erin = await makeUser('erin@example.com', {verified: true, name: 'Erin'});
const frank = await makeUser('frank@example.com', {
  verified: true,
  name: 'Frank',
});
const gina = await makeUser('gina@example.com', {verified: true, name: 'Gina'});
const unverified = await makeUser('hank@example.com', {
  verified: false,
  name: 'Hank',
});
await db.doc('groups/lg1').set({
  name: 'Goa Trip',
  createdBy: alice.uid,
  members: [alice.email, bob.email],
  memberNames: {[alice.email]: 'Alice', [bob.email]: 'Bob'},
  pendingInvites: [erin.email],
});
await db.doc('invitations/linv1').set({
  email: erin.email,
  groupId: 'lg1',
  status: 'pending',
  inviterUid: alice.uid,
});
await db.doc('groups/lg2').set({
  name: 'Other',
  createdBy: carol.uid,
  members: [carol.email],
  memberNames: {[carol.email]: 'Carol'},
  pendingInvites: [],
});

let aliceLink = '';
await step(
  'links: a member makes a link; only its hash is stored',
  async () => {
    const made = await callFn(
      'createGroupInviteLink',
      {groupId: 'lg1'},
      alice.idToken,
    );
    assert.equal(made.status, 200, JSON.stringify(made.body));
    const {token, groupId, expiresAtMs} = made.body.result;
    aliceLink = token;
    assert.equal(groupId, 'lg1');
    assert.match(token, /^[A-Za-z0-9_-]{22}$/);
    const week = 7 * 24 * 3600 * 1000;
    assert.ok(Math.abs(expiresAtMs - (Date.now() + week)) < 60000);
    const stored = await db.doc(`groupInvites/${await sha256(token)}`).get();
    assert.equal(stored.exists, true);
    assert.equal(stored.get('groupId'), 'lg1');
    assert.equal(stored.get('createdByUid'), alice.uid);
    assert.equal(stored.get('revoked'), false);
    // The token itself is nowhere in the database.
    const all = await db.collection('groupInvites').get();
    assert.ok(all.docs.every(d => !JSON.stringify(d.data()).includes(token)));
  },
);

await step(
  'links: signed-out callers, non-members and unverified callers cannot make one',
  async () => {
    assert.equal(
      (await callFn('createGroupInviteLink', {groupId: 'lg1'})).status,
      401,
    );
    assert.equal(
      (await callFn('createGroupInviteLink', {groupId: 'lg1'}, frank.idToken))
        .status,
      403,
    );
    assert.equal(
      (
        await callFn(
          'createGroupInviteLink',
          {groupId: 'lg1'},
          unverified.idToken,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await callFn(
          'createGroupInviteLink',
          {groupId: 'missing'},
          alice.idToken,
        )
      ).status,
      404,
    );
    assert.equal(
      (await callFn('createGroupInviteLink', {}, alice.idToken)).status,
      400,
    );
  },
);

await step('links: preview shows the group name and size only', async () => {
  const preview = await callFn(
    'previewGroupInviteLink',
    {groupId: 'lg1', token: aliceLink},
    frank.idToken,
  );
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.deepEqual(Object.keys(preview.body.result).sort(), [
    'alreadyMember',
    'expiresAtMs',
    'groupId',
    'groupName',
    'memberCount',
  ]);
  assert.equal(preview.body.result.groupName, 'Goa Trip');
  assert.equal(preview.body.result.memberCount, 2);
  assert.equal(preview.body.result.alreadyMember, false);
  const forMember = await callFn(
    'previewGroupInviteLink',
    {groupId: 'lg1', token: aliceLink},
    bob.idToken,
  );
  assert.equal(forMember.body.result.alreadyMember, true);
});

await step(
  'links: a wrong token, a token for another group and a bad format are refused',
  async () => {
    const wrong = await callFn(
      'previewGroupInviteLink',
      {groupId: 'lg1', token: 'AAAAAAAAAAAAAAAAAAAAAA'},
      frank.idToken,
    );
    assert.equal(wrong.status, 404);
    const otherGroup = await callFn(
      'previewGroupInviteLink',
      {groupId: 'lg2', token: aliceLink},
      frank.idToken,
    );
    assert.equal(otherGroup.status, 404);
    const bad = await callFn(
      'previewGroupInviteLink',
      {groupId: 'lg1', token: 'short'},
      frank.idToken,
    );
    assert.equal(bad.status, 400);
  },
);

await step(
  'links: joining adds the verified email and name, and is harmless when repeated',
  async () => {
    const joined = await callFn(
      'joinGroupByLink',
      {groupId: 'lg1', token: aliceLink},
      frank.idToken,
    );
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    assert.deepEqual(joined.body.result, {status: 'joined', groupId: 'lg1'});
    const group = (await db.doc('groups/lg1').get()).data();
    assert.deepEqual(group.members, [alice.email, bob.email, frank.email]);
    assert.equal(group.memberNames[frank.email], 'Frank');
    const again = await callFn(
      'joinGroupByLink',
      {groupId: 'lg1', token: aliceLink},
      frank.idToken,
    );
    assert.deepEqual(again.body.result, {
      status: 'already-member',
      groupId: 'lg1',
    });
    assert.equal((await db.doc('groups/lg1').get()).data().members.length, 3);
    const link = await db.doc(`groupInvites/${await sha256(aliceLink)}`).get();
    assert.equal(link.get('uses'), 1);
  },
);

await step(
  'links: joining answers a pending email invitation to the same group and clears the pending entry',
  async () => {
    const joined = await callFn(
      'joinGroupByLink',
      {groupId: 'lg1', token: aliceLink},
      erin.idToken,
    );
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    const group = (await db.doc('groups/lg1').get()).data();
    assert.ok(group.members.includes(erin.email));
    assert.deepEqual(group.pendingInvites, []);
    assert.equal(
      (await db.doc('invitations/linv1').get()).get('status'),
      'accepted',
    );
  },
);

await step(
  'links: an unverified caller cannot join, and signed-out callers are refused',
  async () => {
    const unverifiedJoin = await callFn(
      'joinGroupByLink',
      {groupId: 'lg1', token: aliceLink},
      unverified.idToken,
    );
    assert.equal(unverifiedJoin.status, 403);
    assert.equal(
      (await callFn('joinGroupByLink', {groupId: 'lg1', token: aliceLink}))
        .status,
      401,
    );
    assert.ok(
      !(await db.doc('groups/lg1').get())
        .data()
        .members.includes(unverified.email),
    );
  },
);

await step(
  'links: three people joining at once through one link are each added once',
  async () => {
    const made = await callFn(
      'createGroupInviteLink',
      {groupId: 'lg2'},
      carol.idToken,
    );
    assert.equal(made.status, 403); // Carol's email is not verified: no link for her group
    await db
      .doc('groups/lg2')
      .update({members: [alice.email], createdBy: alice.uid});
    const own = await callFn(
      'createGroupInviteLink',
      {groupId: 'lg2'},
      alice.idToken,
    );
    assert.equal(own.status, 200, JSON.stringify(own.body));
    const token = own.body.result.token;
    const results = await Promise.all(
      [bob, dave, gina].map(user =>
        callFn('joinGroupByLink', {groupId: 'lg2', token}, user.idToken),
      ),
    );
    assert.ok(
      results.every(r => r.status === 200),
      JSON.stringify(results.map(r => r.body)),
    );
    const members = (await db.doc('groups/lg2').get()).data().members;
    assert.deepEqual(
      [...members].sort(),
      [alice.email, bob.email, dave.email, gina.email].sort(),
    );
    assert.equal(
      (await db.doc(`groupInvites/${await sha256(token)}`).get()).get('uses'),
      3,
    );
  },
);

await step(
  'links: an expired link and a cancelled link say so and add nobody',
  async () => {
    // Expired: move its expiry into the past.
    const made = await callFn(
      'createGroupInviteLink',
      {groupId: 'lg1'},
      alice.idToken,
    );
    const token = made.body.result.token;
    await db
      .doc(`groupInvites/${await sha256(token)}`)
      .update({expiresAt: new Date(Date.now() - 1000)});
    const expired = await callFn(
      'joinGroupByLink',
      {groupId: 'lg1', token},
      gina.idToken,
    );
    assert.equal(expired.status, 400); // failed-precondition
    assert.match(expired.body.error.message, /expired/);
    assert.ok(
      !(await db.doc('groups/lg1').get()).data().members.includes(gina.email),
    );
  },
);

await step(
  'links: a member cancels their own links; the creator cancels every link; others cancel nothing of theirs',
  async () => {
    const bobLink = await callFn(
      'createGroupInviteLink',
      {groupId: 'lg1'},
      bob.idToken,
    );
    assert.equal(bobLink.status, 200, JSON.stringify(bobLink.body));
    const bobToken = bobLink.body.result.token;

    // Bob cancels his own: Alice's links stay valid.
    const byBob = await callFn(
      'revokeGroupInviteLinks',
      {groupId: 'lg1'},
      bob.idToken,
    );
    assert.equal(byBob.status, 200, JSON.stringify(byBob.body));
    assert.equal(byBob.body.result.revoked, 1);
    const bobPreview = await callFn(
      'previewGroupInviteLink',
      {groupId: 'lg1', token: bobToken},
      gina.idToken,
    );
    assert.equal(bobPreview.status, 400);
    assert.match(bobPreview.body.error.message, /cancelled/);
    const alicePreview = await callFn(
      'previewGroupInviteLink',
      {groupId: 'lg1', token: aliceLink},
      gina.idToken,
    );
    assert.equal(alicePreview.status, 200);

    // A non-member cannot cancel anything.
    const byOutsider = await callFn(
      'revokeGroupInviteLinks',
      {groupId: 'lg1'},
      dave.idToken,
    );
    assert.equal(byOutsider.status, 403);

    // The creator cancels every link of the group.
    const byCreator = await callFn(
      'revokeGroupInviteLinks',
      {groupId: 'lg1'},
      alice.idToken,
    );
    assert.equal(byCreator.status, 200);
    assert.ok(byCreator.body.result.revoked >= 1);
    const afterRevoke = await callFn(
      'joinGroupByLink',
      {groupId: 'lg1', token: aliceLink},
      gina.idToken,
    );
    assert.equal(afterRevoke.status, 400);
    assert.match(afterRevoke.body.error.message, /cancelled/);
    assert.ok(
      !(await db.doc('groups/lg1').get()).data().members.includes(gina.email),
    );
  },
);

await step('links: no more than 20 active links per group', async () => {
  await db.doc('groups/lg3').set({
    name: 'Busy',
    createdBy: alice.uid,
    members: [alice.email],
    memberNames: {[alice.email]: 'Alice'},
    pendingInvites: [],
  });
  for (let i = 0; i < 20; i += 1) {
    const made = await callFn(
      'createGroupInviteLink',
      {groupId: 'lg3'},
      alice.idToken,
    );
    assert.equal(made.status, 200, JSON.stringify(made.body));
  }
  const extra = await callFn(
    'createGroupInviteLink',
    {groupId: 'lg3'},
    alice.idToken,
  );
  assert.equal(extra.status, 429);
});

console.log(`\n${passed} invitation checks passed`);
process.exit(0);
