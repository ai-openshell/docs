# Agent Instructions

This repository builds the OpenShell docs site from the docs of several
repositories, listed in `sources.yml`. It holds no page content. See
[CONTRIBUTING.md](CONTRIBUTING.md) for setup and tasks.

## Commands

- `mise run build` fetches every source and builds the site; it fails on broken
  links in `dev` versions.
- `mise run serve` serves the built site.

## Conventions

- `build/`, `.cache/`, and the generated paths under `site/` (see `.gitignore`)
  are build outputs. Never edit or commit them.
- New files need only the license line `SPDX-License-Identifier: Apache-2.0`
  in a comment.

## Commits

- Use Conventional Commits and sign off every commit (`--signoff`).
- Never mention Claude or any AI agent in commits, pull request descriptions, or
  issues (no author attribution, no Co-Authored-By, no "Generated with"
  footers).
