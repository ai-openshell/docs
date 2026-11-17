// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { detect, join, pageKey, parseFrontmatter, read } from '../assembler/adapters.mjs';

const fixture = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const readFixture = (name) => {
  const problems = [];
  return { ...read(fixture(name), problems), problems };
};
const keys = (docs) => docs.pages.map((p) => p.key);

describe('helpers', () => {
  test('join drops empty parts and outer slashes', () => {
    assert.equal(join('', 'sdks/go', '0.1.8'), 'sdks/go/0.1.8');
    assert.equal(join('/a/', '/b//c/'), 'a/b/c');
    assert.equal(join('', ''), '');
  });

  test('pageKey maps index and README files to their directory', () => {
    assert.equal(pageKey('index.mdx'), '');
    assert.equal(pageKey('README.md'), '');
    assert.equal(pageKey('guides/index.mdx'), 'guides');
    assert.equal(pageKey('api/README.md'), 'api');
    assert.equal(pageKey('guides/setup.md'), 'guides/setup');
  });

  test('parseFrontmatter splits YAML front matter from the body', () => {
    assert.deepEqual(parseFrontmatter('---\ntitle: Hi\n---\nBody\n'), { data: { title: 'Hi' }, body: 'Body\n' });
    assert.deepEqual(parseFrontmatter('No front matter'), { data: {}, body: 'No front matter' });
    assert.deepEqual(parseFrontmatter('---\n\n---\nBody'), { data: {}, body: 'Body' });
  });

  test('detect fails on a directory with no known index', () => {
    assert.throws(() => detect(fixture('alpha')), /no docset\.yml, index\.yml or SUMMARY\.md/);
  });
});

describe('native (docset.yml)', () => {
  const docs = readFixture('native');

  test('reads metadata and normalizes redirects', () => {
    assert.equal(docs.format, 'native');
    assert.equal(docs.meta.title, 'Native docs');
    assert.deepEqual(docs.meta.redirects, { 'old-guide': 'guides/setup' });
  });

  test('builds the nav, labels from the nav or the page title', () => {
    assert.deepEqual(docs.nav, [
      { type: 'page', key: '', label: 'Home' },
      { type: 'group', label: 'Guides', items: [{ type: 'page', key: 'guides/setup', label: 'Set up' }] },
      { type: 'link', label: 'Changelog', href: 'https://example.com/changelog' },
    ]);
  });

  test('publishes only pages in the nav and reports missing ones', () => {
    assert.deepEqual(keys(docs), ['', 'guides/setup']);
    assert.deepEqual(docs.problems, ['docset.yml: nav references missing guides/missing.mdx']);
  });

  test('copies non-page files as assets', () => {
    assert.deepEqual(docs.assets, ['guides/diagram.svg']);
  });
});

describe('fern (index.yml)', () => {
  const docs = readFixture('fern');

  test('names pages by section and page slugs, like Fern', () => {
    assert.equal(docs.format, 'fern');
    assert.deepEqual(keys(docs), ['', 'get-started/quick-start', 'elsewhere/custom', 'ref', 'ref/cli-commands']);
  });

  test('a front matter slug replaces the whole path', () => {
    assert.equal(docs.pages.find((p) => p.relPath === 'pages/custom.mdx').key, 'elsewhere/custom');
  });

  test('a section path becomes its overview page', () => {
    const ref = docs.nav.find((n) => n.label === 'Reference');
    assert.deepEqual(ref.items[0], { type: 'page', key: 'ref', label: 'Overview' });
  });

  test('skips hidden pages', () => {
    assert.ok(!docs.pages.some((p) => p.relPath === 'pages/hidden.mdx'));
  });

  test('redirects a section without an overview to its first page', () => {
    assert.deepEqual(docs.meta.redirects, { 'get-started': 'get-started/quick-start' });
    assert.deepEqual(docs.problems, []);
  });
});

describe('mdbook (SUMMARY.md)', () => {
  const docs = readFixture('mdbook');

  test('parts become groups and nested lists become groups headed by their parent', () => {
    assert.equal(docs.format, 'mdbook');
    assert.deepEqual(docs.nav, [
      { type: 'page', key: 'introduction', label: 'Introduction' },
      {
        type: 'group',
        label: 'User Guide',
        items: [
          {
            type: 'group',
            label: 'Getting started',
            items: [
              { type: 'page', key: 'getting-started', label: 'Overview' },
              { type: 'page', key: 'install', label: 'Install' },
            ],
          },
        ],
      },
      { type: 'group', label: 'Reference', items: [{ type: 'page', key: 'api', label: 'API' }] },
    ]);
  });

  test('skips draft chapters and names README pages by their directory', () => {
    assert.deepEqual(keys(docs), ['introduction', 'getting-started', 'install', 'api']);
    assert.deepEqual(docs.problems, []);
  });

  test('does not publish license sidecars as assets', () => {
    assert.deepEqual(docs.assets, []);
  });

  test('drops the page H1, since the site renders the title', () => {
    const install = docs.pages.find((p) => p.key === 'install');
    assert.equal(install.body, 'Run it.\n');
    assert.equal(install.data.title, 'Install');
  });

  test('keeps comments above the H1, such as an SPDX header', () => {
    const intro = docs.pages.find((p) => p.key === 'introduction');
    assert.equal(intro.body, '<!-- SPDX-License-Identifier: Apache-2.0 -->\n\nHello.\n');
  });
});
