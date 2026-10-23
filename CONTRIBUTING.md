# Contributing

Thanks for helping. Bug reports, docs fixes and pull requests are all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- If a document comes out wrong, try the same tree with the `docx` package directly. If it fails there too, the bug is in `docx` and belongs [upstream](https://github.com/dolanmiu/docx/issues); this library only builds the tree.

## Setup

You need [Bun](https://bun.sh) 1.3+ and Node.js 22.19+ (the version is in `.node-version`).

```sh
bun install
bunx playwright install chromium firefox webkit   # once, for the browser and e2e tests
bun run dev                                       # demo app, reading the library's source
```

## Where things live

| path                                         |                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/vue-docx-document/src/core`        | The Vue renderer, the model for the `docx` package, and the writer that turns it into a file.       |
| `packages/vue-docx-document/src/components`  | Primitives, `DocxPreview` and `DocxDownloadButton`.                                                 |
| `packages/vue-docx-document/src/composables` | `useDocx` and `useDocxModel`.                                                                       |
| `packages/vue-docx-document/test`            | Unit tests (Node + happy-dom) and `test/browser` (real engines).                                    |
| `apps/example`                               | The demo, its Playwright e2e tests in `e2e/`, and `src/typecheck` with the README and docs samples. |
| `apps/docs`                                  | The Blume docs site. Live examples come from `apps/example/src/examples/*Example.vue`.              |

## Checks

```sh
bun run check          # samples in sync, format, lint, typecheck, unit tests with coverage
bun run test:browser   # rendering in Chromium, Firefox and WebKit
bun run test:e2e       # builds the demo and drives it with Playwright
bun run build          # fails over the size budgets in packages/vue-docx-document/.size-limit.json
bun run lint:package && bun run test:pack   # after build: publint, types, install the tarball
```

CI runs all of them on every pull request.

## Conventions

- TypeScript strict, `<script setup>` in components, Prettier formatting (`bun run format`).
- Every behavior change comes with a test. Unit tests build real documents and read them back, so a change to the output shows up as a failing assertion.
- Code samples in `packages/vue-docx-document/README.md` and `apps/docs/docs/getting-started.mdx` are type-checked. After editing them, run `bun run sync:samples`.
- Add a line under `## [Unreleased]` in `packages/vue-docx-document/CHANGELOG.md` for anything users will notice.
- Breaking changes need a new major version and an entry under **Changed**.

## License

By contributing you agree that your contributions are licensed under the MIT license.
