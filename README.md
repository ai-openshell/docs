# OpenShell docs

Builds the [OpenShell](https://github.com/NVIDIA/OpenShell) docs site from the
docs of several repositories. Each repository keeps its docs next to its code
and ships them with its releases. This repository holds no page content: it
owns the build, the theme, and the navigation.

| Docset | Repository | Path | Versions |
|---|---|---|---|
| OpenShell | [NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell) | `docs/` | dev (`main`), 0.1.8, 0.1.7 |
| Go SDK | [ai-openshell/sdk-go](https://github.com/ai-openshell/sdk-go) | `docs/src/` | dev (`main`), 0.1.8, 0.1.7 |

## How it works

[`sources.yml`](sources.yml) lists each repository, where it's mounted, and
which tags to publish. The build fetches only the docs directory at each tag or
branch, reads it in its own format (Fern `index.yml`, mdBook `SUMMARY.md`, or
`docset.yml`), checks every link, and builds the site with
[Starlight](https://starlight.astro.build/). Each version is published at its
own path, such as `/0.1.8/about/overview/` or `/sdks/go/dev/`.

To publish a new release, add its tag to `sources.yml`.

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
