<!-- SPDX-License-Identifier: Apache-2.0 -->

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ai-openshell/openshell/main/docs/brand/assets/openshell-banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/ai-openshell/openshell/main/docs/brand/assets/openshell-banner-light.png">
  <img alt="OpenShell" src="https://raw.githubusercontent.com/ai-openshell/openshell/main/docs/brand/assets/openshell-banner-light.png" width="430">
</picture>

# OpenShell website

[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](https://github.com/ai-openshell/docs/blob/main/LICENSE)
[![Security policy](https://img.shields.io/badge/Security-Report%20a%20Vulnerability-red)](https://github.com/ai-openshell/docs/blob/main/SECURITY.md)

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the build details, the other tasks,
and how to change the site. Docs content lives in each source repository;
report and fix content problems there, such as in
[ai-openshell/openshell](https://github.com/ai-openshell/openshell) for the
core docs.

Report vulnerabilities through the [security policy](SECURITY.md).

## License

[Apache 2.0](LICENSE)
