// SPDX-License-Identifier: Apache-2.0

import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { docsetsFor, latestHrefFor, markdownHref, pageFor, pickerFor, sidebarFor, topicsFor } from './versioning';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const page = pageFor(route.id);
  if (!page) return; // 404 keeps Starlight's defaults
  // Agents that fetch the HTML can find the Markdown copy (path + .md; see PageActions).
  const site = context.site ?? context.url;
  route.head.push({
    tag: 'link',
    attrs: { rel: 'alternate', type: 'text/markdown', href: new URL(markdownHref(context.url.pathname), site).href },
  });
  // Dev and older pages name the same page in the latest release as canonical,
  // so search engines index the unversioned URL.
  const latest = latestHrefFor(page);
  if (latest) {
    const canonical = new URL(latest, site).href;
    for (const h of route.head) {
      if (h.tag === 'link' && h.attrs?.rel === 'canonical') h.attrs.href = canonical;
      if (h.tag === 'meta' && h.attrs?.property === 'og:url') h.attrs.content = canonical;
    }
  }
  route.sidebar = sidebarFor(page);
  // prev/next stay inside the current docset
  type Entry = (typeof route.sidebar)[number];
  const links: Extract<Entry, { type: 'link' }>[] = [];
  const flatten = (entries: Entry[]) => {
    for (const e of entries) {
      if (e.type === 'link') links.push(e);
      else flatten(e.entries);
    }
  };
  flatten(route.sidebar);
  const i = links.findIndex((l) => l.isCurrent);
  route.pagination = i < 0 ? { prev: undefined, next: undefined } : { prev: links[i - 1], next: links[i + 1] };
  context.locals.osVersion = { topics: topicsFor(page), picker: pickerFor(page), docsets: docsetsFor(page) };
});
