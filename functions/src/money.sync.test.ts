import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';

/**
 * Cloud Functions are deployed from the functions/ folder alone, so they cannot import the app's
 * money utility. functions/src/money.ts is a verbatim copy of src/utils/money.ts; this test fails
 * if the two drift. After changing the app file, copy it:
 *   cp src/utils/money.ts functions/src/money.ts
 */
describe('money utility copy', () => {
  it('is identical to the app money utility', () => {
    // Compiled tests run from functions/lib, so the repo root is two levels up.
    const root = path.resolve(__dirname, '..', '..');
    const app = fs.readFileSync(
      path.join(root, 'src', 'utils', 'money.ts'),
      'utf8',
    );
    const copy = fs.readFileSync(
      path.join(root, 'functions', 'src', 'money.ts'),
      'utf8',
    );
    assert.equal(copy, app);
  });
});
