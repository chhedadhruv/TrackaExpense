import {describe, expect, it} from '@jest/globals';
import {planGroupEdit} from '../src/utils/groupEdit';

const me = 'me@x.com';

describe('planGroupEdit', () => {
  it('saving an edit with no changes keeps every member and invents no invitation', () => {
    const plan = planGroupEdit(
      [me, 'a@x.com', 'b@x.com'],
      [],
      ['a@x.com', 'b@x.com'],
      me,
    );
    expect(plan.members).toEqual([me, 'a@x.com', 'b@x.com']);
    expect(plan.pendingInvites).toEqual([]);
    expect(plan.newInvitees).toEqual([]);
  });

  it('invites only people who are new', () => {
    const plan = planGroupEdit(
      [me, 'a@x.com'],
      ['p@x.com'],
      ['a@x.com', 'p@x.com', 'n@x.com'],
      me,
    );
    expect(plan.members).toEqual([me, 'a@x.com']);
    expect(plan.pendingInvites).toEqual(['p@x.com', 'n@x.com']);
    expect(plan.newInvitees).toEqual(['n@x.com']);
  });

  it('removes a member who was unticked and drops an unticked pending invitation', () => {
    const plan = planGroupEdit(
      [me, 'a@x.com', 'b@x.com'],
      ['p@x.com'],
      ['a@x.com'],
      me,
    );
    expect(plan.members).toEqual([me, 'a@x.com']);
    expect(plan.pendingInvites).toEqual([]);
    expect(plan.newInvitees).toEqual([]);
  });

  it('keeps the editor as a member even if the stored list lost them', () => {
    const plan = planGroupEdit(['a@x.com'], [], ['a@x.com'], me);
    expect(plan.members).toEqual([me, 'a@x.com']);
  });

  it('never invites the editor or the same person twice', () => {
    const plan = planGroupEdit([me], [], [me, 'n@x.com', 'n@x.com'], me);
    expect(plan.newInvitees).toEqual(['n@x.com']);
    expect(plan.pendingInvites).toEqual(['n@x.com']);
  });

  it('does not modify its inputs', () => {
    const members = [me, 'a@x.com'];
    const pending = ['p@x.com'];
    planGroupEdit(members, pending, ['a@x.com'], me);
    expect(members).toEqual([me, 'a@x.com']);
    expect(pending).toEqual(['p@x.com']);
  });
});
