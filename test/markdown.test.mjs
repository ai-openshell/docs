// SPDX-License-Identifier: Apache-2.0

// Tests the Netlify edge function that serves Markdown to clients that ask for it.
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import negotiate, { config, markdownPath, prefersMarkdown } from '../netlify/edge-functions/markdown.js';

describe('prefersMarkdown', () => {
  for (const [accept, want] of [
    ['text/markdown', true],
    ['text/markdown, text/html, */*', true],
    ['text/html;q=0.9, text/markdown', true],
    ['TEXT/Markdown; charset=utf-8', true],
    ['text/markdown;q=0.5, text/html', false],
    ['text/markdown;q=0', false],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', false],
    ['*/*', false],
    ['text/*', false],
    ['', false],
    [null, false],
  ]) {
    test(`${JSON.stringify(accept)} -> ${want}`, () => assert.equal(prefersMarkdown(accept), want));
  }
});

test('markdownPath', () => {
  assert.equal(markdownPath('/'), '/index.md');
  assert.equal(markdownPath('/about/overview/'), '/about/overview.md');
  assert.equal(markdownPath('/0.1.8/about/overview'), '/0.1.8/about/overview.md');
  assert.equal(markdownPath('/docs/', '/docs/'), '/docs/index.md');
  assert.equal(markdownPath('/docs/sdks/go/', '/docs/'), '/docs/sdks/go.md');
});

// Netlify invokes the function only when the Accept header matches this, so it
// must match every Accept that prefersMarkdown accepts.
test('header rule matches Markdown requests only', () => {
  const rule = new RegExp(config.header.accept);
  for (const accept of ['text/markdown', 'TEXT/Markdown; q=1', 'text/html;q=0.9, text/markdown'])
    assert.ok(rule.test(accept), accept);
  assert.ok(!rule.test('text/html,application/xhtml+xml,*/*;q=0.8'));
});

describe('edge function', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const html = { next: async () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }) };
  const files = (map) => {
    const fetched = [];
    globalThis.fetch = async (url) => {
      const { pathname } = new URL(url);
      fetched.push(pathname);
      return pathname in map
        ? new Response(map[pathname], { headers: { ETag: '"md"' } })
        : new Response('', { status: 404 });
    };
    return fetched;
  };
  const get = (path, accept, init = {}) =>
    new Request(`https://docs.example${path}`, { ...init, headers: { accept, ...init.headers } });

  test('serves the Markdown copy', async () => {
    const fetched = files({ '/docs/about/overview.md': '# Overview' });
    const res = await negotiate(get('/docs/about/overview/', 'text/markdown'), html);
    assert.deepEqual(fetched, ['/docs/about/overview.md']);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(res.headers.get('content-location'), '/docs/about/overview.md');
    assert.equal(res.headers.get('etag'), '"md"');
    assert.equal(res.headers.get('vary'), 'Accept');
    assert.equal(await res.text(), '# Overview');
  });

  test('serves the docs root as /docs/index.md', async () => {
    files({ '/docs/index.md': '# Home' });
    assert.equal(await (await negotiate(get('/docs/', 'text/markdown'), html)).text(), '# Home');
  });

  test('serves HTML to browsers without fetching', async () => {
    const fetched = files({});
    const res = await negotiate(get('/docs/about/overview/', 'text/html,*/*;q=0.8'), html);
    assert.deepEqual(fetched, []);
    assert.equal(await res.text(), '<html>');
  });

  test('falls back to the page when there is no Markdown copy', async () => {
    files({});
    const res = await negotiate(get('/docs/latest/about/overview/', 'text/markdown'), html);
    assert.equal(await res.text(), '<html>');
  });

  test('ignores other methods', async () => {
    const fetched = files({ '/docs/about/overview.md': '# Overview' });
    const res = await negotiate(get('/docs/about/overview/', 'text/markdown', { method: 'POST' }), html);
    assert.deepEqual(fetched, []);
    assert.equal(await res.text(), '<html>');
  });
});
