import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { docsetsFor, pageFor, pickerFor, sidebarFor, topicsFor } from './versioning';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const page = pageFor(route.id);
  if (!page) return; // 404 keeps Starlight's defaults
  // Agents that fetch the HTML can find the Markdown copy (path + .md; see PageActions).
  const md = `${context.url.pathname.replace(/\/$/, '')}.md`;
  route.head.push({
    tag: 'link',
    attrs: { rel: 'alternate', type: 'text/markdown', href: new URL(md, context.site ?? context.url).href },
  });
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
