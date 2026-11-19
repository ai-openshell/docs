<!-- SPDX-License-Identifier: Apache-2.0 -->

# Contributing to the OpenShell docs site

This repository holds the site build, theme, and navigation. Page content lives
in each source repository; change it there. See the [README](README.md) for
how the build works.

## Setup

The site needs Node.js, pinned in [`mise.toml`](mise.toml), and git. Install
[mise](https://mise.jdx.dev/), then:

```shell
mise install
mise run install
```

| Task                | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `mise run build`    | Fetch every source and build the site into `site/dist`   |
| `mise run serve`    | Serve the built site at <http://127.0.0.1:4410/docs/>    |
| `mise run assemble` | Fetch and assemble the sources without building the site |
| `mise run release-sync` | Add new release tags of each source to `sources.yml` |
| `mise run test` | Run the assembler's unit tests |
| `mise run lint` | Check formatting and lint with [Biome](https://biomejs.dev/) |
| `mise run format` | Format the code and apply safe lint fixes |
| `mise run typecheck` | Assemble the sources and type-check the site with `astro check` |

To build against a local checkout instead of a source's `dev` branch, run
`node assembler/assemble.mjs --base /docs/ --local core=../OpenShell` before
`BASE_PATH=/docs/ npm run site`. Broken links in a local checkout fail the
build; in fetched versions they only warn.

## Release sync

The `Release sync` workflow runs `scripts/release-sync.mjs` once a day. It
lists the tags of every repository in `sources.yml` and adds the stable
releases (`vX.Y.Z` or `X.Y.Z`, no pre-release suffix) newer than the newest
listed version. It keeps one pull request open from the `release-sync` branch
and updates it when more releases appear. If you close the pull request, it
isn't reopened until another release appears. To drop a release, merge the
pull request and remove the entry; older tags are never added back.

The workflow uses a GitHub App token, so the `Site` workflow runs on its pull
requests and the commits are signed off by the App's bot user. It needs the
`docs-bot` environment, limited to `main`, with the secrets
`DOCS_BOT_CLIENT_ID` and `DOCS_BOT_PRIVATE_KEY` of an App installed on this
repository with read and write access to contents and pull requests.

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
  the line instead.
