// SPDX-License-Identifier: Apache-2.0

// Serve a page's Markdown copy to clients that ask for Markdown with
// `Accept: text/markdown`. Every page has one at its path plus .md (the site's
// root page uses /index.md; see markdownHref in docs/src/versioning.ts).
// Netlify runs it only for requests whose Accept header mentions
// text/markdown, so browser traffic never invokes it (or costs anything);
// netlify.toml adds `Vary: Accept` to the static responses. Paths without a
// Markdown copy, such as redirect pages, fall back to the normal response.
// scripts/serve.mjs uses the same helpers to do this locally.

// The quality a media range list gives one type, or 0 when it isn't acceptable.
// `exact` counts only ranges that name the type, not text/* or */*.
export function quality(accept, type, { exact = false } = {}) {
  const [major] = type.split('/');
  let best = -1;
  let q = 0;
  for (const part of (accept ?? '').toLowerCase().split(',')) {
    const [range, ...params] = part.split(';').map((s) => s.trim());
    const specificity = range === type ? 2 : exact ? -1 : range === `${major}/*` ? 1 : range === '*/*' ? 0 : -1;
    if (specificity <= best) continue;
    const qParam = params.find((p) => p.startsWith('q='));
    const value = qParam ? Number(qParam.slice(2)) : 1;
    best = specificity;
    q = Number.isFinite(value) ? value : 0;
  }
  return q;
}

// Markdown only when the client names it, and likes it at least as much as HTML.
export function prefersMarkdown(accept) {
  const md = quality(accept, 'text/markdown', { exact: true });
  return md > 0 && md >= quality(accept, 'text/html');
}

// /about/overview/ -> /about/overview.md; the root page -> /index.md.
export const markdownPath = (pathname, base = '/') =>
  pathname === base ? `${base}index.md` : `${pathname.replace(/\/$/, '')}.md`;

// The docs are served under /docs/ (netlify.toml sets BASE_PATH); the landing
// page at / has no Markdown copy and falls through to the normal response.
const BASE = '/docs/';

export default async (request, context) => {
  if (!['GET', 'HEAD'].includes(request.method) || !prefersMarkdown(request.headers.get('accept'))) {
    return context.next();
  }
  const url = new URL(request.url);
  url.pathname = markdownPath(url.pathname, BASE);
  // Forward the request's headers so password-protected deploy previews work.
  const md = await fetch(url, { method: request.method, headers: request.headers });
  if (!md.ok && md.status !== 304) return context.next();
  // fetch has already decoded the body, so don't copy Content-Encoding or Length.
  const headers = new Headers({
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Location': url.pathname,
    Vary: 'Accept',
  });
  for (const name of ['Cache-Control', 'ETag', 'Last-Modified']) {
    if (md.headers.has(name)) headers.set(name, md.headers.get(name));
  }
  return new Response(md.status === 304 ? null : md.body, { status: md.status, headers });
};

// Pages have no file extension; assets, .md copies, llms.txt and the like skip
// this function. The header value is a regular expression matched against the
// whole Accept header; prefersMarkdown then weighs q-values. The handler checks
// the method itself: Netlify's `method` filter doesn't accept HEAD.
export const config = {
  pattern: '^/.*$',
  excludedPattern: '\\.[A-Za-z0-9]+$',
  header: { accept: '[Tt][Ee][Xx][Tt]/[Mm][Aa][Rr][Kk][Dd][Oo][Ww][Nn]' },
};
