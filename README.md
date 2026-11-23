<!-- SPDX-License-Identifier: Apache-2.0 -->

# OpenShell docs

Builds the [OpenShell](https://github.com/ai-openshell/openshell) docs site from the
docs of several repositories. Each repository keeps its docs next to its code
and ships them with its releases. This repository holds no page content: it
owns the build, the theme, and the navigation.

| Docset    | Repository                                                          | Path        | Dev branch |
| --------- | ------------------------------------------------------------------- | ----------- | ---------- |
| OpenShell | [ai-openshell/openshell](https://github.com/ai-openshell/openshell) | `docs/`     | `main`     |
| Go SDK    | [ai-openshell/sdk-go](https://github.com/ai-openshell/sdk-go)       | `docs/src/` | `main`     |

## How it works

[`sources.yml`](sources.yml) lists each repository, where it's mounted, and
which tags to publish. The build fetches only the docs directory at each tag or
branch, reads it in its own format (Fern `index.yml`, mdBook `SUMMARY.md`, or
`docset.yml`), checks every link, and builds the site with
[Starlight](https://starlight.astro.build/). The newest release of each
repository is published without a version in the URL, such as
`/about/overview/` or `/sdks/go/`, so links always show the current docs. Other
versions have their own path, such as `/<version>/about/overview/` or
`/sdks/go/dev/`.

Broken links in fetched versions are warnings, so one repository can't block
the site. To check a change to a repository's docs, build with `--local` (see
[CONTRIBUTING.md](CONTRIBUTING.md)), where broken links are errors. Pull request
previews for source repositories are tracked in
[#2](https://github.com/ai-openshell/docs/issues/2).

To publish a new release, add its tag to `sources.yml`.

The published website serves a small landing page from [`www/`](www/)
at `/` and the docs at `/docs/`. [`scripts/website.mjs`](scripts/website.mjs)
combines the two after the docs build.

## Website pages

The landing page, [`www/index.html`](www/index.html), is hand-written HTML.
Other pages outside the docs, such as `/community/`, are Markdown files in
`www/` with a `title` and `description` in their front matter.
`scripts/website.mjs` renders each `www/<name>.md` into the landing page's
header and footer at `/<name>/`. To add a page, add a Markdown file and its link
to [`theme/nav.json`](theme/nav.json), which the site bar reads. `:name:` in a
page, such as `:github:`, inserts the icon `www/icons/<name>.svg`. `mise run
website` builds the whole website, and `mise run serve-website` serves it.

Every page, docs included, renders the same site bar from
[`theme/site-bar.mjs`](theme/site-bar.mjs): wordmark, site links, search,
GitHub, and theme toggle, with one stylesheet (`theme/site-bar.css`) and
script (`theme/search.js`). Search uses the docs build's
[Pagefind](https://pagefind.app/) index, and `scripts/website.mjs` indexes the
website pages into `/pagefind-www/`; on the full website (`WEBSITE=1`, as
Netlify and `mise run website` set it) search merges the two. A docs-only
build searches the docs only.

## Markdown for agents

Every page has a Markdown copy at its URL plus `.md`, such as
`/docs/about/overview.md` or `/community.md`. The docs list theirs in
`/docs/llms.txt`, and each docs page links to its copy in the page actions menu
(Copy page, View as Markdown, Open in Claude or ChatGPT).

The assembler writes the docs copies from each page's source, so they keep
the source's text rather than the rendered HTML. Source repositories can mark
content for one output only: `<llms-only>` blocks appear only in the Markdown
copy, and `<llms-ignore>` blocks only on the site.

## Hosting

The website is hosted on [Netlify](https://www.netlify.com/) under the CNCF's
account. [`netlify.toml`](netlify.toml) holds the build settings, which
override the Netlify UI: Netlify runs `npm run build && npm run website` with
`BASE_PATH=/docs/` and publishes `build/website`. Netlify also builds a deploy
preview for each pull request.

The [Site workflow](.github/workflows/site.yml) also builds the docs on every
pull request and publishes them to GitHub Pages from `main`, at
`/<repository>/` and without the landing page.

## Run it locally

```shell
mise install
mise run install
mise run build
mise run serve
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for more.

## License

[Apache 2.0](LICENSE)
