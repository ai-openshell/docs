<!-- SPDX-License-Identifier: Apache-2.0 -->

# OpenShell docs

Builds the [OpenShell](https://github.com/NVIDIA/OpenShell) docs site from the
docs of several repositories. Each repository keeps its docs next to its code
and ships them with its releases. This repository holds no page content: it
owns the build, the theme, and the navigation.

| Docset    | Repository                                                    | Path        |
| --------- | ------------------------------------------------------------- | ----------- |
| OpenShell | [NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell)       | `docs/`     |
| Go SDK    | [ai-openshell/sdk-go](https://github.com/ai-openshell/sdk-go) | `docs/src/` |

Each docset publishes the releases listed in [`sources.yml`](sources.yml) and
a `dev` version built from the repository's `main` branch.

## How it works

[`sources.yml`](sources.yml) lists each repository, where it's mounted, and
which tags to publish. The build fetches only the docs directory at each tag or
branch, reads it in its own format (Fern `index.yml`, mdBook `SUMMARY.md`, or
`docset.yml`), checks every link, and builds the site with
[Starlight](https://starlight.astro.build/). Each version is published at its
own path, such as `/0.1.8/about/overview/` or `/sdks/go/dev/`.

Broken links in fetched versions are warnings, so one repository can't block
the site. To check a change to a repository's docs, build with `--local` (see
[CONTRIBUTING.md](CONTRIBUTING.md)), where broken links are errors. Pull request
previews for source repositories are tracked in
[#2](https://github.com/ai-openshell/docs/issues/2).

New releases are picked up by the `Release sync` workflow. Once a day it lists
each source's tags and opens (or updates) one pull request that adds the
stable releases newer than the newest listed version to `sources.yml`. Merging
it publishes them. To add a release now, run the workflow by hand, or run
`node scripts/release-sync.mjs` and open the pull request yourself.

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
