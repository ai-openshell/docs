// SPDX-License-Identifier: Apache-2.0

// Navigation data for a page. Every docset page belongs to one (docset,
// version): its sidebar and version picker are that docset's. Links to other
// docsets (topic tabs, sub-tabs) go to their latest release. Topic landing
// pages (/sdks/, /drivers/) belong to no docset.
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import nav from './generated/nav.json';
import pages from './generated/pages.json';

type NavItem = { type: 'page'; label: string; slug: string } | { type: 'group'; label: string; items: NavItem[] };
type NavLink = { type: 'link'; label: string; href: string };
type SidebarEntry = StarlightRouteData['sidebar'][number];
type Version = {
  name: string;
  ref: string;
  prefix: string;
  first: string;
  pages: string[];
  items: (NavItem | NavLink)[];
  latest?: boolean;
  dev?: boolean;
};
type Docset = { title: string; description?: string; mount: string; latest: string; versions: Version[] };
export type Page = {
  slug: string;
  title: string;
  source: string | null;
  version?: string;
  key: string;
  topic?: string;
  latest?: boolean;
  dev?: boolean;
  edit?: string;
};

const docsets = nav.docsets as unknown as Record<string, Docset>;
const topics = nav.topics as unknown as { id: string; label: string; sources: string[]; landing?: string }[];
const bySlug = new Map((pages as unknown as Page[]).map((p) => [p.slug, p]));
const base = (nav as { base?: string }).base ?? '/';
export const href = (slug: string) => base + (slug ? `${slug}/` : '');

export function pageFor(id: string): Page | undefined {
  return bySlug.get(id.replace(/^\/|\/$/g, ''));
}
// nav.json and pages.json are generated together, so a lookup that fails
// means the generated data is inconsistent.
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`docs navigation: ${what} not found`);
  return value;
}
const release = (docset: string, version: string | undefined) =>
  must(
    docsets[docset].versions.find((v) => v.name === version),
    `${docset}@${version}`,
  );
const topicOf = (page: Page) =>
  must(
    topics.find((t) => (page.source ? t.sources.includes(page.source) : t.id === page.topic)),
    `topic of ${page.slug}`,
  );

/** The version of `docset` to link from `page`: the page's own version for its docset, else latest. */
const versionFor = (page: Page, docset: string) => (docset === page.source ? page.version : docsets[docset].latest);

export function topicsFor(page: Page) {
  const current = topicOf(page);
  return topics.map((t) => {
    let link: string;
    if (t.landing) link = href(t.landing);
    else {
      const d = t.sources[0];
      const r = release(d, versionFor(page, d));
      link = href(r.first);
    }
    return { label: t.label, href: link, isCurrent: t.id === current.id };
  });
}

/** The docsets of the current topic (sub-tabs). */
export function docsetsFor(page: Page) {
  const t = topicOf(page);
  return {
    topic: { label: t.label, landing: t.landing ? href(t.landing) : undefined, isLanding: !page.source },
    items: t.sources.map((d) => {
      const r = release(d, versionFor(page, d));
      return {
        id: d,
        title: docsets[d].title,
        description: docsets[d].description,
        version: r.name,
        href: href(r.first),
        current: d === page.source,
      };
    }),
  };
}

/**
 * Sidebar entries: the current docset's pages at the current version. Other
 * docsets are reached through the sub-tabs, and topic overview pages have no
 * sidebar (splash template, set by sync.mjs).
 */
export function sidebarFor(page: Page) {
  if (!page.source) return [];
  // Top-level groups start open, nested ones collapsed; Starlight opens any
  // group that contains the current page.
  const toEntry = (it: NavItem | NavLink, depth = 0): SidebarEntry =>
    it.type === 'group'
      ? {
          type: 'group',
          label: it.label,
          entries: it.items.map((x) => toEntry(x, depth + 1)),
          collapsed: depth > 0,
          badge: undefined,
        }
      : it.type === 'link'
        ? { type: 'link', label: it.label, href: it.href, isCurrent: false, badge: undefined, attrs: {} }
        : {
            type: 'link',
            label: it.label,
            href: href(it.slug),
            isCurrent: it.slug === page.slug,
            badge: undefined,
            attrs: {},
          };
  return release(page.source, page.version).items.map((it) => toEntry(it));
}

/** Versions of the current docset; each option keeps the same page when that version has it. */
export function pickerFor(page: Page) {
  if (!page.source) return undefined;
  const d = docsets[page.source];
  return {
    title: d.title,
    current: page.version,
    options: d.versions.map((v) => ({
      name: v.name,
      latest: v.name === d.latest,
      dev: !!v.dev && v.name !== d.latest,
      current: v.name === page.version,
      href: href(v.pages.includes(page.key) ? [v.prefix, page.key].filter(Boolean).join('/') : v.first),
      samePage: v.pages.includes(page.key),
    })),
  };
}

/** What routeData.ts stores in Astro.locals for the header and the version picker. */
export type OsVersion = {
  topics: ReturnType<typeof topicsFor>;
  picker: ReturnType<typeof pickerFor>;
  docsets: ReturnType<typeof docsetsFor>;
};
