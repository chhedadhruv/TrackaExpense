import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {ReceiptScanError, checkPath} from './receipt';
import {recognizeText} from './vision';

describe('checkPath', () => {
  it('accepts the caller own file one level down', () => {
    assert.equal(
      checkPath('u1', {storagePath: 'bills/u1/a.jpg'}),
      'bills/u1/a.jpg',
    );
  });

  it('refuses another user, nested paths, traversal and empty names', () => {
    for (const storagePath of [
      'bills/u2/a.jpg',
      'bills/u1/sub/a.jpg',
      'bills/u1/../u2/a.jpg',
      'bills/u1/',
      'bills/u1',
      'other/u1/a.jpg',
      '/bills/u1/a.jpg',
      `bills/u1/${'x'.repeat(300)}`,
    ]) {
      assert.throws(
        () => checkPath('u1', {storagePath}),
        (e: unknown) =>
          e instanceof ReceiptScanError && e.code === 'permission-denied',
        storagePath,
      );
    }
  });

  it('needs a string storagePath', () => {
    for (const input of [undefined, null, {}, {storagePath: 5}, 'bills/u1/a']) {
      assert.throws(
        () => checkPath('u1', input),
        (e: unknown) =>
          e instanceof ReceiptScanError && e.code === 'invalid-argument',
      );
    }
  });
});

describe('recognizeText', () => {
  const image = Buffer.from('fake image');

  it('posts the image with a bearer token and returns the text', async () => {
    let seen: {url: string; init: RequestInit} | undefined;
    const text = await recognizeText(image, async () => 'tok', (async (
      url: string,
      init: RequestInit,
    ) => {
      seen = {url, init};
      return {
        ok: true,
        status: 200,
        json: async () => ({
          responses: [{fullTextAnnotation: {text: 'TOTAL 5.00'}}],
        }),
      };
    }) as unknown as typeof fetch);
    assert.equal(text, 'TOTAL 5.00');
    assert.match(seen!.url, /vision\.googleapis\.com/);
    assert.equal(
      (seen!.init.headers as Record<string, string>).Authorization,
      'Bearer tok',
    );
    const body = JSON.parse(String(seen!.init.body));
    assert.equal(body.requests[0].image.content, image.toString('base64'));
    assert.equal(body.requests[0].features[0].type, 'DOCUMENT_TEXT_DETECTION');
  });

  it('returns empty text when nothing was found', async () => {
    const text = await recognizeText(image, async () => 't', (async () => ({
      ok: true,
      status: 200,
      json: async () => ({responses: [{}]}),
    })) as unknown as typeof fetch);
    assert.equal(text, '');
  });

  it('throws on an API error', async () => {
    await assert.rejects(
      recognizeText(image, async () => 't', (async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          responses: [{error: {message: 'API not enabled'}}],
        }),
      })) as unknown as typeof fetch),
      /API not enabled/,
    );
  });
});
