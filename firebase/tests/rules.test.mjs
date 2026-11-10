// Rules tests. Run with: yarn test:rules (starts the emulators; touches no live project).
import {describe, it, before, after, beforeEach} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(dir, '..', f), 'utf8');

let env;
const ALICE = {uid: 'alice', email: 'alice@example.com'};
const BOB = {uid: 'bob', email: 'bob@example.com'};
const CAROL = {uid: 'carol', email: 'carol@example.com'};

const as = u => env.authenticatedContext(u.uid, {email: u.email});
const dbOf = u => as(u).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();

async function seed() {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), {
      name: 'Alice',
      email: ALICE.email,
      phone: '1',
      balance: 100,
      fcmToken: 't',
    });
    await setDoc(doc(db, 'users/bob'), {
      name: 'Bob',
      email: BOB.email,
      phone: '2',
      balance: 50,
    });
    await setDoc(doc(db, 'users/alice/transactions/t1'), {
      title: 'x',
      amount: '10',
      type: 'expense',
      date: '2026-01-01',
    });
    await setDoc(doc(db, 'groups/g1'), {
      name: 'Trip',
      members: [ALICE.email],
      memberNames: {[ALICE.email]: 'Alice'},
      pendingInvites: [BOB.email],
      createdBy: 'alice',
    });
    await setDoc(doc(db, 'groups/g1/splits/s1'), {
      title: 'Dinner',
      amount: 100,
    });
    await setDoc(doc(db, 'groups/g1/splits/s1/history/h1'), {action: 'create'});
    await setDoc(doc(db, 'invitations/i1'), {
      email: BOB.email,
      groupId: 'g1',
      status: 'pending',
      inviterUid: 'alice',
    });
    await setDoc(doc(db, 'ious/o1'), {
      fromEmail: ALICE.email,
      toEmail: BOB.email,
      status: 'pending',
      amount: 5,
    });
    await setDoc(doc(db, 'mail/m1'), {to: 'x@example.com'});
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-trackaexpense-rules',
    firestore: {rules: read('firestore.rules')},
    storage: {rules: read('storage.rules')},
  });
});
after(async () => {
  await env.cleanup();
});
beforeEach(seed);

describe('firestore: unauthenticated', () => {
  it('cannot read users, groups, invitations', async () => {
    const db = anonDb();
    await assertFails(getDoc(doc(db, 'users/alice')));
    await assertFails(getDoc(doc(db, 'groups/g1')));
    await assertFails(getDocs(collection(db, 'invitations')));
  });
  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(anonDb(), 'users/new'), {name: 'x'}));
  });
});

describe('firestore: users', () => {
  it('signed-in user can read another profile and look users up by email and phone', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(getDoc(doc(db, 'users/bob')));
    await assertSucceeds(
      getDocs(query(collection(db, 'users'), where('email', '==', BOB.email))),
    );
    await assertSucceeds(
      getDocs(query(collection(db, 'users'), where('phone', '==', '2'))),
    );
  });
  it('can create and update own document only', async () => {
    await assertSucceeds(
      setDoc(doc(dbOf(CAROL), 'users/carol'), {
        name: 'Carol',
        email: CAROL.email,
        balance: 0,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(dbOf(ALICE), 'users/alice'), {name: 'Alice B'}),
    );
    await assertFails(setDoc(doc(dbOf(CAROL), 'users/mallory'), {name: 'x'}));
    await assertFails(
      updateDoc(doc(dbOf(ALICE), 'users/bob'), {name: 'Hacked'}),
    );
  });
  it('settle-up may change only the balance of another user', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(ALICE), 'users/bob'), {balance: increment(-10)}),
    );
    await assertFails(
      updateDoc(doc(dbOf(ALICE), 'users/bob'), {balance: 'free'}),
    );
    await assertFails(
      updateDoc(doc(dbOf(ALICE), 'users/bob'), {
        balance: increment(1),
        email: 'x@y.z',
      }),
    );
  });
  it('cannot delete another user', async () => {
    await assertFails(deleteDoc(doc(dbOf(ALICE), 'users/bob')));
    await assertSucceeds(deleteDoc(doc(dbOf(BOB), 'users/bob')));
  });
  it('subcollections are owner-only', async () => {
    await assertSucceeds(
      getDoc(doc(dbOf(ALICE), 'users/alice/transactions/t1')),
    );
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'users/alice/transactions'), {title: 'y'}),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(dbOf(ALICE), 'users/alice/transactions'),
          orderBy('title'),
        ),
      ),
    );
    await assertFails(getDoc(doc(dbOf(BOB), 'users/alice/transactions/t1')));
    await assertFails(
      addDoc(collection(dbOf(BOB), 'users/alice/transactions'), {title: 'y'}),
    );
  });
});

describe('firestore: groups', () => {
  it('member can list their groups with array-contains and read the group', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'groups'),
          where('members', 'array-contains', ALICE.email),
        ),
      ),
    );
    await assertSucceeds(getDoc(doc(db, 'groups/g1')));
  });
  it('a non-member cannot read the group or list all groups', async () => {
    await assertFails(getDoc(doc(dbOf(CAROL), 'groups/g1')));
    await assertFails(getDocs(collection(dbOf(CAROL), 'groups')));
    await assertFails(
      getDocs(
        query(
          collection(dbOf(CAROL), 'groups'),
          where('members', 'array-contains', ALICE.email),
        ),
      ),
    );
  });
  it('create requires createdBy to be the caller', async () => {
    const db = dbOf(CAROL);
    await assertSucceeds(
      addDoc(collection(db, 'groups'), {
        name: 'N',
        members: [CAROL.email],
        createdBy: 'carol',
        pendingInvites: [],
      }),
    );
    await assertFails(
      addDoc(collection(db, 'groups'), {
        name: 'N',
        members: [CAROL.email],
        createdBy: 'alice',
        pendingInvites: [],
      }),
    );
  });
  it('invitee can read the group, accept, and decline', async () => {
    const db = dbOf(BOB);
    await assertSucceeds(getDoc(doc(db, 'groups/g1')));
    await assertSucceeds(
      updateDoc(doc(db, 'groups/g1'), {
        members: arrayUnion(BOB.email),
        pendingInvites: arrayRemove(BOB.email),
      }),
    );
  });
  it('invitee can decline', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(BOB), 'groups/g1'), {
        pendingInvites: arrayRemove(BOB.email),
      }),
    );
  });
  it('an outsider cannot update or delete the group', async () => {
    await assertFails(
      updateDoc(doc(dbOf(CAROL), 'groups/g1'), {name: 'Mine now'}),
    );
    await assertFails(deleteDoc(doc(dbOf(CAROL), 'groups/g1')));
  });
  it('member can delete the group', async () => {
    await assertSucceeds(deleteDoc(doc(dbOf(ALICE), 'groups/g1')));
  });
});

describe('firestore: group subcollections', () => {
  it('members can read and write splits and nested history', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(
      getDocs(
        query(collection(db, 'groups/g1/splits'), orderBy('amount', 'desc')),
      ),
    );
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/splits'), {title: 'Lunch', amount: 20}),
    );
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/splitHistory'), {action: 'x'}),
    );
    await assertSucceeds(getDoc(doc(db, 'groups/g1/splits/s1/history/h1')));
  });
  it('non-members and invitees cannot access splits', async () => {
    await assertFails(getDocs(collection(dbOf(CAROL), 'groups/g1/splits')));
    await assertFails(
      addDoc(collection(dbOf(CAROL), 'groups/g1/splits'), {title: 'x'}),
    );
    await assertFails(getDocs(collection(dbOf(BOB), 'groups/g1/splits')));
  });
});

describe('firestore: invitations', () => {
  it('invitee lists pending invitations by email and status', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(dbOf(BOB), 'invitations'),
          where('email', '==', BOB.email),
          where('status', '==', 'pending'),
        ),
      ),
    );
  });
  it('inviter can look up an invitation by group and email', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(dbOf(ALICE), 'invitations'),
          where('groupId', '==', 'g1'),
          where('email', '==', BOB.email),
        ),
      ),
    );
  });
  it('create requires inviterUid to be the caller', async () => {
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'invitations'), {
        email: CAROL.email,
        groupId: 'g1',
        inviterUid: 'alice',
        status: 'pending',
      }),
    );
    await assertFails(
      addDoc(collection(dbOf(CAROL), 'invitations'), {
        email: CAROL.email,
        groupId: 'g1',
        inviterUid: 'alice',
        status: 'pending',
      }),
    );
  });
  it('invitee can respond, a stranger cannot', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(BOB), 'invitations/i1'), {status: 'accepted'}),
    );
    await assertFails(
      updateDoc(doc(dbOf(CAROL), 'invitations/i1'), {status: 'accepted'}),
    );
  });
});

describe('firestore: ious', () => {
  it('parties can query and update, others cannot', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(dbOf(ALICE), 'ious'),
          where('fromEmail', '==', ALICE.email),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc'),
        ),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(dbOf(BOB), 'ious/o1'), {status: 'settled'}),
    );
    await assertFails(getDoc(doc(dbOf(CAROL), 'ious/o1')));
    await assertFails(getDocs(collection(dbOf(CAROL), 'ious')));
  });
  it('create requires the caller to be a party', async () => {
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'ious'), {
        fromEmail: ALICE.email,
        toEmail: BOB.email,
      }),
    );
    await assertFails(
      addDoc(collection(dbOf(CAROL), 'ious'), {
        fromEmail: ALICE.email,
        toEmail: BOB.email,
      }),
    );
  });
});

describe('firestore: other collections', () => {
  it('contact messages can be created by the sender but never read', async () => {
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'contact_messages'), {
        userId: 'alice',
        messageText: 'hi',
      }),
    );
    await assertFails(
      addDoc(collection(dbOf(ALICE), 'contact_messages'), {
        userId: 'bob',
        messageText: 'hi',
      }),
    );
    await assertFails(getDocs(collection(dbOf(ALICE), 'contact_messages')));
  });
  it('mail and unknown collections are closed to clients', async () => {
    await assertFails(getDoc(doc(dbOf(ALICE), 'mail/m1')));
    await assertFails(
      addDoc(collection(dbOf(ALICE), 'mail'), {to: 'x@example.com'}),
    );
    await assertFails(setDoc(doc(dbOf(ALICE), 'anything/else'), {a: 1}));
  });
});

// Replays of the multi-step flows in the screens, in the same order as the app code.
describe('flows replayed from the app', () => {
  it('accept invitation: transaction on the group, then update the invitation', async () => {
    const db = dbOf(BOB);
    const groupRef = doc(db, 'groups/g1');
    await assertSucceeds(
      runTransaction(db, async tx => {
        const snap = await tx.get(groupRef);
        const g = snap.data();
        const members = [...g.members, BOB.email];
        const pendingInvites = g.pendingInvites.filter(e => e !== BOB.email);
        tx.update(groupRef, {
          members,
          memberNames: {...g.memberNames, [BOB.email]: 'Bob'},
          pendingInvites,
          updatedAt: new Date(),
        });
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'invitations/i1'), {
        status: 'accepted',
        respondedAt: new Date(),
      }),
    );
    // now a member: can read splits
    await assertSucceeds(getDocs(collection(db, 'groups/g1/splits')));
  });

  it('create split as payer: split doc, history, own transaction and own balance', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/splits'), {
        title: 'Taxi',
        amount: 30,
        createdAt: new Date(),
      }),
    );
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/splits/s1/history'), {action: 'edit'}),
    );
    await assertSucceeds(
      addDoc(collection(db, 'users/alice/transactions'), {
        title: 'Taxi',
        source: 'split',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users/alice'), {balance: increment(-30)}),
    );
    await assertSucceeds(
      addDoc(collection(db, 'users/alice/splitHistory'), {type: 'create'}),
    );
  });

  it('settle up: settlement, split, history and both balances', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/settlements'), {amount: 10}),
    );
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/splits'), {
        isSettlement: true,
        amount: 10,
      }),
    );
    await assertSucceeds(
      addDoc(collection(db, 'groups/g1/splitHistory'), {action: 'settle'}),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users/alice'), {balance: increment(-10)}),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'users/bob'), {balance: increment(10)}),
    );
  });

  it('delete group: splits first, then the group', async () => {
    const db = dbOf(ALICE);
    const snap = await getDocs(collection(db, 'groups/g1/splits'));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await assertSucceeds(batch.commit());
    await assertSucceeds(deleteDoc(doc(db, 'groups/g1')));
  });

  it('leave group: member removes own email and name', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(ALICE), 'groups/g1'), {
        members: arrayRemove(ALICE.email),
        [`memberNames.${ALICE.email}`]: deleteField(),
      }),
    );
  });

  it('signup: user document is created by the new user', async () => {
    const db = dbOf(CAROL);
    await assertSucceeds(
      setDoc(doc(db, 'users/carol'), {
        name: 'Carol',
        email: CAROL.email,
        phone: '3',
        currency: 'INR',
        balance: 0,
        userImg: null,
        createdAt: new Date(),
        verified: false,
      }),
    );
  });

  it('send a contact message and re-invite a declined member', async () => {
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'contact_messages'), {
        userId: 'alice',
        category: 'bug',
        messageText: 'x',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(dbOf(ALICE), 'invitations/i1'), {
        status: 'pending',
        createdAt: new Date(),
      }),
    );
  });
});

// ---- Stage A: uid membership, server-only memberIds, immutable owner, member-only invitations.
async function seedUidGroup() {
  // A group the way the memberIds trigger leaves it: Alice is a member by uid only here (her
  // email is not in members), Bob by email.
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'groups/g2'), {
      name: 'Uid group',
      members: [BOB.email],
      memberIds: ['alice', 'bob'],
      memberNames: {[BOB.email]: 'Bob'},
      pendingInvites: [],
      createdBy: 'bob',
    });
    await setDoc(doc(db, 'groups/g2/splits/s1'), {title: 'Lunch', amount: 10});
  });
}

describe('stage A: group membership by uid', () => {
  beforeEach(seedUidGroup);

  it('a member by uid can list their groups with memberIds array-contains and read the group', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'groups'),
          where('memberIds', 'array-contains', 'alice'),
        ),
      ),
    );
    await assertSucceeds(getDoc(doc(db, 'groups/g2')));
  });
  it('listing by someone else uid is refused', async () => {
    await assertFails(
      getDocs(
        query(
          collection(dbOf(CAROL), 'groups'),
          where('memberIds', 'array-contains', 'alice'),
        ),
      ),
    );
    await assertFails(getDoc(doc(dbOf(CAROL), 'groups/g2')));
  });
  it('a member by uid can use the splits and settlements of the group', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(getDoc(doc(db, 'groups/g2/splits/s1')));
    await assertSucceeds(
      setDoc(doc(db, 'groups/g2/splits/s2'), {title: 'Taxi'}),
    );
    await assertSucceeds(
      setDoc(doc(db, 'groups/g2/settlements/x1'), {amount: 5}),
    );
    await assertFails(getDoc(doc(dbOf(CAROL), 'groups/g2/splits/s1')));
  });
  it('a member by uid can update the group but not take it over', async () => {
    const db = dbOf(ALICE);
    await assertSucceeds(updateDoc(doc(db, 'groups/g2'), {name: 'Renamed'}));
    await assertFails(updateDoc(doc(db, 'groups/g2'), {createdBy: 'alice'}));
  });
  it('the old email based access still works for groups without memberIds', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(dbOf(ALICE), 'groups'),
          where('members', 'array-contains', ALICE.email),
        ),
      ),
    );
    await assertSucceeds(getDoc(doc(dbOf(ALICE), 'groups/g1/splits/s1')));
  });
});

describe('stage A: memberIds is written only by the server', () => {
  beforeEach(seedUidGroup);

  it('a client cannot create a group with memberIds', async () => {
    const base = {name: 'New', members: [ALICE.email], createdBy: 'alice'};
    await assertSucceeds(setDoc(doc(dbOf(ALICE), 'groups/new1'), base));
    await assertFails(
      setDoc(doc(dbOf(ALICE), 'groups/new2'), {
        ...base,
        memberIds: ['alice', 'carol'],
      }),
    );
  });
  it('a client cannot set, add to or remove memberIds on an existing group', async () => {
    const db = dbOf(ALICE);
    await assertFails(
      updateDoc(doc(db, 'groups/g2'), {memberIds: ['alice', 'carol']}),
    );
    await assertFails(
      updateDoc(doc(db, 'groups/g2'), {memberIds: arrayUnion('carol')}),
    );
    await assertFails(
      updateDoc(doc(db, 'groups/g2'), {memberIds: deleteField()}),
    );
    // A group without memberIds cannot get one from a client either.
    await assertFails(updateDoc(doc(db, 'groups/g1'), {memberIds: ['alice']}));
  });
  it('other fields can still be updated while memberIds is present and untouched', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(ALICE), 'groups/g2'), {
        members: arrayUnion(CAROL.email),
        memberNames: {[BOB.email]: 'Bob', [CAROL.email]: 'Carol'},
        updatedAt: new Date(),
      }),
    );
  });
});

describe('stage A: the owner of a group cannot change', () => {
  const oldEditShape = (uid, email) => ({
    name: 'Edited',
    category: 'Work',
    members: [email],
    createdBy: uid,
    updatedAt: new Date(),
    memberNames: {[email]: 'x'},
    pendingInvites: [BOB.email],
  });

  it('the creator saving a group keeps working (createdBy unchanged)', async () => {
    await assertSucceeds(
      updateDoc(
        doc(dbOf(ALICE), 'groups/g1'),
        oldEditShape('alice', ALICE.email),
      ),
    );
  });
  it('another member cannot make themselves the owner', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'groups/g1'), {
        members: [ALICE.email, BOB.email],
      });
    });
    await assertFails(
      updateDoc(doc(dbOf(BOB), 'groups/g1'), oldEditShape('bob', BOB.email)),
    );
    await assertFails(
      updateDoc(doc(dbOf(BOB), 'groups/g1'), {createdBy: 'bob'}),
    );
    await assertSucceeds(
      updateDoc(doc(dbOf(BOB), 'groups/g1'), {name: 'Bob renamed'}),
    );
  });
  it('accept and decline still work for an invitee', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(BOB), 'groups/g1'), {
        members: arrayUnion(BOB.email),
        pendingInvites: arrayRemove(BOB.email),
      }),
    );
  });
});

describe('stage A: only a member can invite to a group', () => {
  beforeEach(seedUidGroup);
  const invite = (groupId, extra = {}) => ({
    email: CAROL.email,
    groupId,
    groupName: 'x',
    inviterUid: 'alice',
    inviterEmail: ALICE.email,
    status: 'pending',
    ...extra,
  });

  it('a member by email or by uid can create a pending invitation', async () => {
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'invitations'), invite('g1')),
    );
    await assertSucceeds(
      addDoc(collection(dbOf(ALICE), 'invitations'), invite('g2')),
    );
  });
  it('a non-member cannot invite to someone else group', async () => {
    await assertFails(
      addDoc(
        collection(dbOf(CAROL), 'invitations'),
        invite('g1', {inviterUid: 'carol'}),
      ),
    );
    await assertFails(
      addDoc(
        collection(dbOf(CAROL), 'invitations'),
        invite('g2', {inviterUid: 'carol'}),
      ),
    );
  });
  it('an invitation must start as pending and belong to an existing group', async () => {
    const col = collection(dbOf(ALICE), 'invitations');
    await assertFails(addDoc(col, invite('g1', {status: 'accepted'})));
    const {status: _omitted, ...withoutStatus} = invite('g1');
    await assertFails(addDoc(col, withoutStatus));
    await assertFails(addDoc(col, invite('no-such-group')));
  });
  it('an invitee still responds to their own invitation', async () => {
    await assertSucceeds(
      updateDoc(doc(dbOf(BOB), 'invitations/i1'), {status: 'declined'}),
    );
  });
});

// The rules-unit-testing storage context exposes the compat API (ref().put()).
const png = new Uint8Array([137, 80, 78, 71]);
describe('storage', () => {
  const st = u => as(u).storage();
  const putAdmin = async p => {
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.storage().ref(p).put(png, {contentType: 'image/png'});
    });
  };
  it('owner can upload an image to bills/{uid}/', async () => {
    await assertSucceeds(
      st(ALICE).ref('bills/alice/a.png').put(png, {contentType: 'image/png'}),
    );
  });
  it('another user cannot write into someone else path', async () => {
    await assertFails(
      st(BOB).ref('bills/alice/a.png').put(png, {contentType: 'image/png'}),
    );
  });
  it('non-image content is rejected', async () => {
    await assertFails(
      st(ALICE).ref('bills/alice/a.txt').put(png, {contentType: 'text/plain'}),
    );
  });
  it('signed-in users can read receipts, anonymous cannot', async () => {
    await putAdmin('bills/alice/r.png');
    await assertSucceeds(st(BOB).ref('bills/alice/r.png').getMetadata());
    await assertFails(
      env
        .unauthenticatedContext()
        .storage()
        .ref('bills/alice/r.png')
        .getMetadata(),
    );
  });
  it('only the owner can delete', async () => {
    await putAdmin('bills/alice/d.png');
    await assertFails(st(BOB).ref('bills/alice/d.png').delete());
    await assertSucceeds(st(ALICE).ref('bills/alice/d.png').delete());
  });
  it('every other path is closed', async () => {
    await assertFails(
      st(ALICE).ref('other/a.png').put(png, {contentType: 'image/png'}),
    );
    await assertFails(
      st(ALICE)
        .ref('bills/alice/sub/a.png')
        .put(png, {contentType: 'image/png'}),
    );
  });
});
