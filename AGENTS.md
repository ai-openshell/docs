<!-- SPDX-License-Identifier: Apache-2.0 -->

# Agent Instructions

This repository builds the OpenShell website and docs from the docs of several
repositories, listed in `sources.yml`. It holds no page content. See
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and tasks.

## Commands

- `mise run build` fetches every source and builds the site. Broken links in
  fetched versions only warn; fix them in the source repository. Broken links
  in a `--local` checkout fail the build.
- `mise run serve` serves the built site.
- `mise run lint` checks formatting and lint (Biome, warnings fail); run it
  before every commit. `mise run format` fixes formatting.
- `mise run test` runs the assembler's tests (`node:test`, in `test/`). The
  assembler test builds small local git repos from `test/fixtures/`, so it
  needs no network.
- `mise run typecheck` type-checks the site, including `.astro` files.

## Conventions

- `build/`, `.cache/`, and the generated paths under `docs/` (see `.gitignore`)
  are build outputs. Never edit or commit them.
- Every file needs `SPDX-License-Identifier: Apache-2.0` in a comment in its
  first 10 lines (front matter in `.mdx` and `.astro`), or a `<file>.license`
  sidecar for JSON and images. CI checks it.

## Commits

- Use Conventional Commits and sign off every commit (`--signoff`).
- Never mention Claude or any AI agent in commits, pull request descriptions, or
  issues (no author attribution, no Co-Authored-By, no "Generated with"
  footers).
