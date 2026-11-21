<!-- SPDX-License-Identifier: Apache-2.0 -->

# OpenShell docs

Builds the [OpenShell](https://github.com/ai-openshell/openshell) docs site from the
docs of several repositories. Each repository keeps its docs next to its code
and ships them with its releases. This repository holds no page content: it
owns the build, the theme, and the navigation.

| Docset    | Repository                                                          | Path        | Versions                          |
| --------- | ------------------------------------------------------------------- | ----------- | --------------------------------- |
| OpenShell | [ai-openshell/openshell](https://github.com/ai-openshell/openshell) | `docs/`     | dev (`main`), 0.1.9, 0.1.8, 0.1.7 |
| Go SDK    | [ai-openshell/sdk-go](https://github.com/ai-openshell/sdk-go)       | `docs/src/` | dev (`main`), 0.1.8, 0.1.7        |

## How it works

[`sources.yml`](sources.yml) lists each repository, where it's mounted, and
which tags to publish. The build fetches only the docs directory at each tag or
branch, reads it in its own format (Fern `index.yml`, mdBook `SUMMARY.md`, or
`docset.yml`), checks every link, and builds the site with
[Starlight](https://starlight.astro.build/). The newest release of each
repository is published without a version in the URL, such as
`/about/overview/` or `/sdks/go/`, so links always show the current docs. Other
versions have their own path, such as `/0.1.8/about/overview/` or
`/sdks/go/dev/`.

Every page also has a Markdown copy at its path plus `.md`, listed in
`/llms.txt`. On Netlify, an [edge function](netlify/edge-functions/markdown.js)
serves that copy at the page's own URL to clients that send
`Accept: text/markdown`.

Broken links in fetched versions are warnings, so one repository can't block
the site. To check a change to a repository's docs, build with `--local` (see
[CONTRIBUTING.md](CONTRIBUTING.md)), where broken links are errors. Pull request
previews for source repositories are tracked in
[#2](https://github.com/ai-openshell/docs/issues/2).

To publish a new release, add its tag to `sources.yml`.

The published website serves a small landing page from [`www/`](www/)
at `/` and the docs at `/docs/`. [`scripts/website.mjs`](scripts/website.mjs)
combines the two after the docs build.

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
