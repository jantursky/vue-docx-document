import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changelogProblems, unreleasedEntries } from './changelog-check.js'

const empty = '# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-10-23\n\n### Changed\n\n- Something.\n'
const filled = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A thing.\n\n## [1.0.1] - 2026-10-23\n'
const src = 'packages/vue-docx-document/src/core/write.ts'

test('reads the Unreleased section only', () => {
  assert.equal(unreleasedEntries(empty), '')
  assert.equal(unreleasedEntries(filled), '### Added\n\n- A thing.')
})

test('reads Unreleased when it is the last section before the link list', () => {
  const text = '## [Unreleased]\n\n- Entry.\n\n[Unreleased]: https://example.com/compare\n'
  assert.equal(unreleasedEntries(text), '- Entry.')
})

test('finds no section when the heading is missing', () => {
  assert.equal(unreleasedEntries('# Changelog\n'), '')
})

test('a source change with an empty section fails and names the file', () => {
  const [problem, ...rest] = changelogProblems([src, 'README.md'], empty)
  assert.equal(rest.length, 0)
  assert.match(problem, /write\.ts/)
  assert.match(problem, /no-changelog/)
})

test('a source change with an entry passes', () => {
  assert.deepEqual(changelogProblems([src], filled), [])
})

test('changes outside the source need no entry', () => {
  assert.deepEqual(changelogProblems(['README.md', 'apps/docs/docs/index.mdx', 'bun.lock'], empty), [])
})
