import {describe, expect, it} from '@jest/globals';
import {
  INVITE_LINK_BASE,
  buildInviteUrl,
  inviteLinkErrorMessage,
  inviteMessage,
  joinPath,
  parseInviteInput,
  systemPathFor,
} from '../src/utils/inviteLinks';

const TOKEN = 'AbCdEfGhIjKlMnOpQrSt_-';
const GROUP = 'h4g4mjGBjnkkqkdgIy4r';

describe('systemPathFor', () => {
  it('turns a verified invite link into the app route', () => {
    expect(systemPathFor(buildInviteUrl(GROUP, TOKEN))).toBe(
      joinPath(GROUP, TOKEN),
    );
  });

  it('accepts a trailing slash, a query and a different case of the host', () => {
    const fragment = `#g=${GROUP}&t=${TOKEN}`;
    for (const base of [
      'https://trackaexpense.dhruvchheda.com/join/',
      'https://trackaexpense.dhruvchheda.com/join?utm=x',
      'HTTPS://TrackaExpense.DhruvChheda.com/join',
    ]) {
      expect(systemPathFor(`${base}${fragment}`)).toBe(joinPath(GROUP, TOKEN));
    }
  });

  it('sends a broken invite link to the Split tab, not an unmatched route', () => {
    for (const url of [
      'https://trackaexpense.dhruvchheda.com/join',
      'https://trackaexpense.dhruvchheda.com/join#',
      'https://trackaexpense.dhruvchheda.com/join#g=only',
      `https://trackaexpense.dhruvchheda.com/join#g=${GROUP}&t=short`,
    ]) {
      expect(systemPathFor(url)).toBe('/split');
    }
  });

  it('leaves every other URL unchanged', () => {
    for (const url of [
      'trackaexpense://split/join/h4g4mjGBjnkkqkdgIy4r/AbCdEfGhIjKlMnOpQrSt_-',
      'trackaexpense://home',
      '/home',
      'https://trackaexpense.dhruvchheda.com/',
      'https://trackaexpense.dhruvchheda.com/privacy',
      'https://trackaexpense.dhruvchheda.com/joinus#g=a&t=b',
      'https://evil.example.com/join#g=a&t=b',
      'http://trackaexpense.dhruvchheda.com/join#g=a&t=b',
    ]) {
      expect(systemPathFor(url)).toBe(url);
    }
  });
});

describe('buildInviteUrl', () => {
  it('puts the group and token in the fragment, never the path or query', () => {
    const url = buildInviteUrl(GROUP, TOKEN);
    expect(url).toBe(`${INVITE_LINK_BASE}#g=${GROUP}&t=${TOKEN}`);
    expect(url.split('#')[0]).toBe(INVITE_LINK_BASE);
    expect(url.split('#')[0]).not.toContain(TOKEN);
    expect(url).not.toContain('?');
  });
});

describe('parseInviteInput', () => {
  it('reads the shared web link', () => {
    expect(parseInviteInput(buildInviteUrl(GROUP, TOKEN))).toEqual({
      groupId: GROUP,
      token: TOKEN,
    });
  });

  it('reads the app link and the bare path', () => {
    const target = {groupId: GROUP, token: TOKEN};
    expect(
      parseInviteInput(`trackaexpense://split/join/${GROUP}/${TOKEN}`),
    ).toEqual(target);
    expect(parseInviteInput(joinPath(GROUP, TOKEN))).toEqual(target);
    expect(parseInviteInput(`${joinPath(GROUP, TOKEN)}/`)).toEqual(target);
  });

  it('copes with surrounding spaces and a trailing query', () => {
    const target = {groupId: GROUP, token: TOKEN};
    expect(parseInviteInput(`  ${buildInviteUrl(GROUP, TOKEN)}  `)).toEqual(
      target,
    );
    expect(
      parseInviteInput(`trackaexpense://split/join/${GROUP}/${TOKEN}?x=1`),
    ).toEqual(target);
  });

  it('rejects other links, a short token and missing parts', () => {
    for (const bad of [
      '',
      'hello',
      'https://example.com/join',
      `${INVITE_LINK_BASE}#g=${GROUP}`,
      `${INVITE_LINK_BASE}#t=${TOKEN}`,
      `${INVITE_LINK_BASE}#g=${GROUP}&t=short`,
      `trackaexpense://split/join/${GROUP}/short`,
      `trackaexpense://split/group/${GROUP}`,
      `/split/join/${GROUP}`,
    ]) {
      expect(parseInviteInput(bad)).toBeNull();
    }
  });
});

describe('inviteLinkErrorMessage', () => {
  it('keeps the server wording and drops the code prefix', () => {
    expect(
      inviteLinkErrorMessage({
        message:
          '[functions/failed-precondition] This invite link has expired.',
      }),
    ).toBe('This invite link has expired.');
    expect(
      inviteLinkErrorMessage({message: 'This invite link was cancelled.'}),
    ).toBe('This invite link was cancelled.');
  });

  it('uses a generic line for bare codes, empty messages and non-errors', () => {
    for (const error of [
      {message: 'NOT_FOUND'},
      {message: '[functions/not-found] NOT_FOUND'},
      {message: 'UNAVAILABLE'},
      {message: ''},
      {},
      null,
      undefined,
      'boom',
    ]) {
      expect(inviteLinkErrorMessage(error)).toBe(
        'Could not use this invite link. Check your connection and try again.',
      );
    }
  });
});

describe('inviteMessage', () => {
  it('names the group, carries the link and states the expiry', () => {
    const url = buildInviteUrl(GROUP, TOKEN);
    const message = inviteMessage('Goa Trip', url);
    expect(message).toContain('"Goa Trip"');
    expect(message).toContain(url);
    expect(message).toContain('7 days');
  });
});
