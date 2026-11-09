// Integration test of sendPush. The logic runs against the Firestore emulator with a fake
// OneSignal (no request ever leaves the machine); the callable itself is checked through the Auth
// and Functions emulators.
//
// Run: yarn test:push   (needs JDK 21 or newer; demo project, no live project is touched).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const {sendPush, PushError, MAX_CALLS_PER_HOUR} = require('../lib/push.js');

const project = process.env.GCLOUD_PROJECT || 'demo-trackaexpense-push';
initializeApp({projectId: project});
const db = getFirestore();
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

// A fake OneSignal that records requests.
const makeFetch = respond => {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({url, init, body: JSON.parse(init.body)});
    return respond();
  };
  fn.calls = calls;
  return fn;
};
const accepted = () => ({ok: true, json: async () => ({id: 'onesignal-1'})});
const rejected = () => ({
  ok: false,
  json: async () => ({errors: ['All included players are not subscribed']}),
});

const alice = {uid: 'ua', email: 'alice@example.com', emailVerified: true};
await db.doc('users/ua').set({email: 'alice@example.com'});
await db.doc('users/ub').set({email: 'bob@example.com'});
await db.doc('users/uc').set({email: 'carol@example.com'});
await db.doc('users/ud').set({email: 'dave@example.com'});
await db.doc('groups/g1').set({
  name: 'Trip',
  members: ['alice@example.com', 'bob@example.com'],
  pendingInvites: ['carol@example.com', 'ghost@example.com'],
});

const payload = (overrides = {}) => ({
  emails: ['alice@example.com'],
  type: 'reminder',
  title: 'Hello',
  body: 'World',
  data: {type: 'reminder', action: 'add_expense'},
  ...overrides,
});
let clock = 1_000_000_000_000;
// apiKey: a string, or null for "the secret is not set".
const deps = (fetchFn, apiKey = 'secret-key') => ({
  db,
  fetchFn,
  apiKey: apiKey ?? undefined,
  appId: 'app-id-1',
  now: () => clock,
});
const code = async promise => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof PushError, String(error));
    return error.code;
  }
  assert.fail('expected a PushError');
};
const inbox = async email =>
  (
    await db
      .collection(`users/${email.replace('@', '_at_')}/notifications`)
      .get()
  ).docs.map(d => d.data());

await step(
  'self notification: sent through OneSignal by uid with the API key',
  async () => {
    const fetchFn = makeFetch(accepted);
    const result = await sendPush(deps(fetchFn), alice, payload());
    assert.deepEqual(result, {
      sent: true,
      stored: false,
      recipients: 1,
      skipped: 0,
    });
    assert.equal(fetchFn.calls.length, 1);
    const call = fetchFn.calls[0];
    assert.equal(call.url, 'https://api.onesignal.com/notifications?c=push');
    assert.equal(call.init.headers.Authorization, 'Key secret-key');
    assert.equal(call.body.app_id, 'app-id-1');
    assert.equal(call.body.target_channel, 'push');
    assert.deepEqual(call.body.include_aliases, {external_id: ['ua']});
    assert.deepEqual(call.body.headings, {en: 'Hello'});
    assert.deepEqual(call.body.contents, {en: 'World'});
    assert.equal(call.body.data.action, 'add_expense');
    assert.equal(call.body.data.type, 'reminder');
    assert.equal(JSON.stringify(call.body).includes('fcmToken'), false);
  },
);

await step(
  'group notification: members and pending invitees only, strangers dropped',
  async () => {
    const fetchFn = makeFetch(accepted);
    const result = await sendPush(
      deps(fetchFn),
      alice,
      payload({
        groupId: 'g1',
        emails: [
          'bob@example.com',
          'carol@example.com',
          'dave@example.com',
          'ghost@example.com',
        ],
      }),
    );
    // Dave is not in the group; Ghost is invited but has no account.
    assert.deepEqual(result, {
      sent: true,
      stored: false,
      recipients: 3,
      skipped: 1,
    });
    assert.deepEqual(fetchFn.calls[0].body.include_aliases.external_id.sort(), [
      'ub',
      'uc',
    ]);
  },
);

await step(
  'a caller outside the group cannot use it, and nobody can message strangers',
  async () => {
    const fetchFn = makeFetch(accepted);
    const dave = {uid: 'ud', email: 'dave@example.com', emailVerified: true};
    assert.equal(
      await code(
        sendPush(
          deps(fetchFn),
          dave,
          payload({groupId: 'g1', emails: ['bob@example.com']}),
        ),
      ),
      'permission-denied',
    );
    assert.equal(
      await code(
        sendPush(
          deps(fetchFn),
          dave,
          payload({groupId: 'missing', emails: ['bob@example.com']}),
        ),
      ),
      'permission-denied',
    );
    // Without a group the caller may only notify themselves.
    assert.equal(
      await code(
        sendPush(deps(fetchFn), alice, payload({emails: ['bob@example.com']})),
      ),
      'permission-denied',
    );
    assert.equal(fetchFn.calls.length, 0);
  },
);

await step('an unverified email cannot send', async () => {
  const fetchFn = makeFetch(accepted);
  assert.equal(
    await code(
      sendPush(deps(fetchFn), {...alice, emailVerified: false}, payload()),
    ),
    'permission-denied',
  );
  assert.equal(
    await code(
      sendPush(deps(fetchFn), {...alice, email: undefined}, payload()),
    ),
    'permission-denied',
  );
  assert.equal(fetchFn.calls.length, 0);
});

await step(
  'OneSignal failing or missing keeps an in-app copy instead',
  async () => {
    const failing = makeFetch(rejected);
    const result = await sendPush(
      deps(failing),
      alice,
      payload({emails: ['alice@example.com']}),
    );
    assert.deepEqual(result, {
      sent: false,
      stored: true,
      recipients: 1,
      skipped: 0,
    });
    const first = await inbox('alice@example.com');
    assert.equal(first.length, 1);
    assert.equal(first[0].title, 'Hello');
    assert.equal(first[0].read, false);

    const throwing = async () => {
      throw new Error('network down');
    };
    const second = await sendPush(deps(throwing), alice, payload());
    assert.equal(second.stored, true);
    const noKey = makeFetch(accepted);
    const third = await sendPush(deps(noKey, null), alice, payload());
    assert.deepEqual(third, {
      sent: false,
      stored: true,
      recipients: 1,
      skipped: 0,
    });
    assert.equal(noKey.calls.length, 0);
    assert.equal((await inbox('alice@example.com')).length, 3);
  },
);

await step('people without an account are skipped quietly', async () => {
  const fetchFn = makeFetch(accepted);
  await db.doc('groups/g2').set({
    name: 'Solo',
    members: ['alice@example.com'],
    pendingInvites: ['nobody@example.com'],
  });
  const result = await sendPush(
    deps(fetchFn),
    alice,
    payload({groupId: 'g2', emails: ['nobody@example.com']}),
  );
  assert.deepEqual(result, {
    sent: false,
    stored: false,
    recipients: 0,
    skipped: 0,
  });
  assert.equal(fetchFn.calls.length, 0);
});

await step(
  'rate limit: per caller per hour, then the window resets',
  async () => {
    const fetchFn = makeFetch(accepted);
    await db
      .doc('pushLimits/ua')
      .set({windowStart: clock, count: MAX_CALLS_PER_HOUR});
    assert.equal(
      await code(sendPush(deps(fetchFn), alice, payload())),
      'resource-exhausted',
    );
    assert.equal(fetchFn.calls.length, 0);
    clock += 60 * 60 * 1000 + 1;
    const result = await sendPush(deps(fetchFn), alice, payload());
    assert.equal(result.sent, true);
    assert.equal((await db.doc('pushLimits/ua').get()).get('count'), 1);
  },
);

await step('bad payloads are rejected', async () => {
  const fetchFn = makeFetch(accepted);
  const bad = [
    null,
    'x',
    {},
    payload({emails: []}),
    payload({emails: ['not-an-email']}),
    payload({emails: Array.from({length: 51}, (_, i) => `${i}@example.com`)}),
    payload({title: ''}),
    payload({title: 'x'.repeat(121)}),
    payload({body: 'x'.repeat(501)}),
    payload({type: ''}),
    payload({data: 'text'}),
    payload({data: {big: 'x'.repeat(3000)}}),
    payload({groupId: 'a/b'}),
  ];
  for (const input of bad) {
    assert.equal(
      await code(sendPush(deps(fetchFn), alice, input)),
      'invalid-argument',
    );
  }
  assert.equal(fetchFn.calls.length, 0);
});

// ---- the callable through the Functions and Auth emulators
const authCall = async (path, body) =>
  (
    await fetch(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/${path}?key=fake`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...body, returnSecureToken: true}),
      },
    )
  ).json();
const callSendPush = async (data, idToken) => {
  const response = await fetch(
    `http://127.0.0.1:5001/${project}/asia-south1/sendPush`,
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

await step(
  'callable: signed-out refused; verified caller reaches the in-app copy without a key',
  async () => {
    const signedOut = await callSendPush(payload(), null);
    assert.equal(signedOut.status, 401);

    const {localId} = await authCall('accounts:signUp', {
      email: 'erin@example.com',
      password: 'not-a-real-password',
    });
    await getAuth().updateUser(localId, {emailVerified: true});
    const {idToken} = await authCall('accounts:signInWithPassword', {
      email: 'erin@example.com',
      password: 'not-a-real-password',
    });
    await db.doc(`users/${localId}`).set({email: 'erin@example.com'});

    const unverifiedTarget = await callSendPush(
      payload({emails: ['alice@example.com']}),
      idToken,
    );
    assert.equal(unverifiedTarget.status, 403);

    const self = await callSendPush(
      payload({emails: ['erin@example.com']}),
      idToken,
    );
    assert.equal(self.status, 200, JSON.stringify(self.body));
    // No ONESIGNAL_API_KEY in the emulator: the in-app copy is kept.
    assert.deepEqual(self.body.result, {
      sent: false,
      stored: true,
      recipients: 1,
      skipped: 0,
    });
    assert.equal((await inbox('erin@example.com')).length, 1);
  },
);

console.log(`\n${passed} push checks passed`);
process.exit(0);
