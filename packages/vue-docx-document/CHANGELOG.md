# Changelog

All notable changes to `vue-docx-document` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Lenient rendering: with an `onWarn` handler or `strict: false`, a misplaced element (such as text directly in a `<List>`, a `<TableCell>` outside a `<TableRow>` or a `<Paragraph>` outside a `<Section>`), a `<Document>` without a `<Section>` and an image that fails to load are left out with a warning, and the rest of the document is written. Without either option they still throw. `strict: true` rejects the render on the first warning. The render functions, the `DocxInstance` methods, `useDocx` and `useDocxModel` take these options.
- Warnings are `{ code, message, section, element }` objects. Match on `code`: `misplaced-element`, `dropped-text`, `missing-section`, `image-failed`, `unsafe-link` or `missing-bookmark`.
- A `loadImage` option loads image sources that are not data URIs, in place of `fetch`, for files on disk, authenticated assets or a scheme of your own.
- Image URLs time out after 10 seconds. The `imageTimeout` option changes that.

### Changed

- A warning that goes to the console repeats once per render, instead of once per process.

## [1.0.2] - 2026-11-15

### Changed

- The `vue` peer dependency is back at `^3.5.0`. A dependency update had raised it to `^3.5.45`, which asked consumers on older 3.5 releases to upgrade for no reason. CI tests 3.5.0 and fails if the range moves, and Dependabot no longer bumps it.
- The `docx` engine is updated to 9.15.3.

### Added

- Supported environments are documented, and CI now renders from the packed tarball on Node 20, 22 and 24.

## [1.0.1] - 2026-10-23

### Changed

- The README shows a screenshot of an example and its live preview, and links it to the demo.

## [1.0.0] - 2026-10-23

### Added

- First release.

[Unreleased]: https://github.com/jantursky/vue-docx-document/compare/1.0.2...HEAD
[1.0.2]: https://github.com/jantursky/vue-docx-document/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/jantursky/vue-docx-document/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/jantursky/vue-docx-document/releases/tag/1.0.0
