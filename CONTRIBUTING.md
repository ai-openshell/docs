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

| Task | What it does |
|------|--------------|
| `mise run build` | Fetch every source and build the site into `site/dist` |
| `mise run serve` | Serve the built site at <http://127.0.0.1:4410/docs/> |
| `mise run assemble` | Fetch and assemble the sources without building the site |

To build against a local checkout instead of a source's `dev` branch, run
`node assembler/assemble.mjs --base /docs/ --local core=../OpenShell` before
`BASE_PATH=/docs/ npm run site`.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `<type>(<scope>): <description>`.
- Sign off every commit (`git commit --signoff`) for the [Developer Certificate
  of Origin](https://developercertificate.org/).
- Every change goes through a pull request. Pull requests are squash-merged.
- New files need only the license line `SPDX-License-Identifier: Apache-2.0`
  in a comment. Keep the existing headers as they are.
