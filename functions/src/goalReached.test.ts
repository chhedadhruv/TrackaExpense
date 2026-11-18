import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {crossedTarget, isReached} from './goalReached';

const goal = (current: unknown, target: unknown) => ({
  currentMinor: current,
  targetMinor: target,
});

describe('isReached', () => {
  it('is true at and above the target', () => {
    assert.equal(isReached(goal(10000, 10000)), true);
    assert.equal(isReached(goal(10001, 10000)), true);
  });

  it('is false below the target', () => {
    assert.equal(isReached(goal(9999, 10000)), false);
    assert.equal(isReached(goal(0, 10000)), false);
  });

  it('is false without a usable target or amount', () => {
    assert.equal(isReached(undefined), false);
    assert.equal(isReached(goal(0, 0)), false);
    assert.equal(isReached(goal(5, -1)), false);
    assert.equal(isReached(goal(undefined, 100)), false);
    assert.equal(isReached(goal('100', 100)), false);
    assert.equal(isReached(goal(100, '100')), false);
  });
});

describe('crossedTarget', () => {
  it('fires when a goal goes from below to reached', () => {
    assert.equal(crossedTarget(goal(9000, 10000), goal(10000, 10000)), true);
    assert.equal(crossedTarget(goal(0, 10000), goal(50000, 10000)), true);
  });

  it('fires for a new goal that is already full', () => {
    assert.equal(crossedTarget(undefined, goal(10000, 10000)), true);
  });

  it('does not fire for edits of a goal that is already reached', () => {
    assert.equal(crossedTarget(goal(10000, 10000), goal(12000, 10000)), false);
    assert.equal(crossedTarget(goal(10000, 10000), goal(10000, 10000)), false);
  });

  it('does not fire while below the target', () => {
    assert.equal(crossedTarget(goal(100, 10000), goal(200, 10000)), false);
    assert.equal(crossedTarget(undefined, goal(0, 10000)), false);
  });

  it('does not fire when the goal is removed or loses its amount', () => {
    assert.equal(crossedTarget(goal(10000, 10000), undefined), false);
    assert.equal(crossedTarget(goal(10000, 10000), goal(5000, 10000)), false);
  });

  it('fires again after a withdrawal and a new fill', () => {
    const reached = goal(10000, 10000);
    const below = goal(4000, 10000);
    assert.equal(crossedTarget(reached, below), false);
    assert.equal(crossedTarget(below, reached), true);
  });

  it('fires when the target is lowered to or under the saved amount', () => {
    assert.equal(crossedTarget(goal(8000, 10000), goal(8000, 8000)), true);
  });
});
