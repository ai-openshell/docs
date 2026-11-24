<!-- SPDX-License-Identifier: Apache-2.0 -->

# OpenShell docs

Builds the [OpenShell](https://github.com/ai-openshell/openshell) website and
docs from the docs of several repositories. Each repository keeps its docs next
to its code and ships them with its releases. This repository holds no docs
content: it owns the build, the theme, the navigation, and the few pages outside
the docs, such as the landing page, in [`website/`](website/).

| Docset    | Repository                                                          | Path        | Dev branch |
| --------- | ------------------------------------------------------------------- | ----------- | ---------- |
| OpenShell | [ai-openshell/openshell](https://github.com/ai-openshell/openshell) | `docs/`     | `main`     |

## How it works

[`sources.yml`](sources.yml) lists each repository, where it's mounted, and
which tags to publish. The build fetches only the docs directory at each tag or
branch, checks every link, and builds the docs with
[Starlight](https://starlight.astro.build/). The newest release of each
repository is published without a version in the URL, such as
`/docs/about/overview/`; other versions have their own path, such as
`/docs/0.1.8/about/overview/` or `/docs/dev/about/overview/`.

The website serves the landing page and the community page at `/` and the docs
at `/docs/`, all with one site bar and one search. Every page also has a
Markdown copy for agents at its URL plus `.md`. The site is hosted on Netlify
under the CNCF's account.

To publish a new release, add its tag to `sources.yml`.

## Run it locally

```shell
mise install
mise run install
mise run website
mise run serve-website
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the build details, the other tasks,
and how to change the site.

## License

[Apache 2.0](LICENSE)
