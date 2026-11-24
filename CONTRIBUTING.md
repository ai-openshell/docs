<!-- SPDX-License-Identifier: Apache-2.0 -->

# Contributing to the OpenShell docs site

This repository holds the site build, theme, and navigation, and the pages
outside the docs. Docs content lives in each source repository; change it
there. See the [README](README.md) for an overview.

## Setup

The site needs Node.js, pinned in [`mise.toml`](mise.toml), and git. Install
[mise](https://mise.jdx.dev/), then:

```shell
mise install
mise run install
```

| Task                     | What it does                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `mise run website`       | Build the docs and the website pages into `build/website`          |
| `mise run serve-website` | Serve the website at <http://127.0.0.1:4410/>                      |
| `mise run build`         | Fetch every source and build only the docs into `site/dist`        |
| `mise run serve`         | Serve the docs build at <http://127.0.0.1:4410/docs/>              |
| `mise run assemble`      | Fetch and assemble the sources without building the site           |
| `mise run test`          | Run the assembler's unit tests                                     |
| `mise run lint`          | Check formatting and lint with [Biome](https://biomejs.dev/)       |
| `mise run format`        | Format the code and apply safe lint fixes                          |
| `mise run typecheck`     | Assemble the sources and type-check the site with `astro check`    |

## How the docs build works

[`sources.yml`](sources.yml) lists each source repository, where it's mounted,
and which tags to publish; `dev` is a branch built as an extra, unreleased
version, and `archive` is a URL where versions no longer published here are
still hosted, which the version picker and `llms.txt` link to. The assembler ([`assembler/`](assembler/)) fetches only the docs
directory at each ref, reads it in its own format (Fern `index.yml`, mdBook
`SUMMARY.md`, or `docset.yml`), and writes the Starlight content, navigation,
and Markdown copies. The commits it used are recorded in
`build/assembled/sources.lock.json`.

Broken links in fetched versions are warnings, so one repository can't block
the site. To check a change to a repository's docs, build against a local
checkout, where broken links are errors:

```shell
node assembler/assemble.mjs --base /docs/ --local core=../OpenShell
BASE_PATH=/docs/ npm run site
```

Pull request previews for source repositories are tracked in
[#2](https://github.com/ai-openshell/docs/issues/2).

## Website pages

[`website/`](website/) holds the website's own pages, the ones outside the docs;
the docs come from the sources and are built in `site/`.
[`scripts/website.mjs`](scripts/website.mjs) puts the files in `website/` at `/`
and the docs build at `/docs/`, into `build/website/`. The landing page,
[`website/index.html`](website/index.html), is hand-written HTML. Other pages,
such as `/community/`, are Markdown files in `website/` with a `title` and
`description` in their front matter; each `website/<name>.md` is rendered into
the landing page's shell at `/<name>/`.

To add a page, add a Markdown file and its link to
[`theme/nav.json`](theme/nav.json). `:name:` in a page, such as `:github:`,
inserts the icon `website/icons/<name>.svg`.

## Site bar and search

Every page, docs included, renders the same site bar from
[`theme/site-bar.mjs`](theme/site-bar.mjs): wordmark, site links, search,
GitHub, and theme toggle. The docs header
([`Header.astro`](site/src/components/overrides/Header.astro)) and
`scripts/website.mjs` both call it, and both use the same styles
(`theme/site-bar.css`) and scripts (`theme/search.js`,
`theme/theme-toggle.js`), so change the bar only in `theme/`.

Search shows [Pagefind](https://pagefind.app/)'s UI in the site bar's dialog;
Starlight's own search box isn't used. Starlight builds the docs index (the
latest release of each docset only), and `scripts/website.mjs` indexes the
website pages into `/pagefind-website/`. When built with `WEBSITE=1`, as Netlify
and `mise run website` do, search merges the two, with the website pages at
half weight so they don't outrank the docs. Each page records its section
(such as Core or Community) as Pagefind metadata, which the results show as a
label.

## Markdown for agents

Every page has a Markdown copy at its URL plus `.md`, such as
`/docs/about/overview.md` or `/community.md`. The docs list theirs in
`/docs/llms.txt`; `/llms.txt` links to it and lists the website pages.
Each docs page links to its copy in the page actions menu
(Copy page, View as Markdown, Open in Claude or ChatGPT). On Netlify, an
[edge function](netlify/edge-functions/markdown.js) serves the copy at the
page's own URL to clients that send `Accept: text/markdown`;
`mise run serve-website` does the same locally.

The assembler writes the docs copies from each page's source, so they keep the
source's text rather than the rendered HTML. Source repositories can mark
content for one output only: `<llms-only>` blocks appear only in the Markdown
copy, and `<llms-ignore>` blocks only on the site.

## Hosting

The website is hosted on [Netlify](https://www.netlify.com/) under the CNCF's
account. [`netlify.toml`](netlify.toml) holds the build settings, which
override the Netlify UI: Netlify runs `npm run build && npm run website` with
`BASE_PATH=/docs/` and `WEBSITE=1`, and publishes `build/website`. Netlify also
builds a deploy preview for each pull request.

The [Site workflow](.github/workflows/site.yml) builds the docs on every pull
request and publishes them to GitHub Pages from `main`, at `/<repository>/`
and without the website pages.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `<type>(<scope>): <description>`.
- Sign off every commit (`git commit --signoff`) for the [Developer Certificate
  of Origin](https://developercertificate.org/).
- Every change goes through a pull request. Pull requests are squash-merged.
- Every file needs the license line `SPDX-License-Identifier: Apache-2.0` in
  a comment in its first 10 lines; the `SPDX` workflow checks it. In `.mdx`
  and `.astro` files, put it in the front matter. A file that can't hold a
  comment, such as JSON or an image, gets a `<file>.license` file containing
  the line instead. Third-party artwork, such as the CNCF logos and
  `website/icons/`, is excluded.
