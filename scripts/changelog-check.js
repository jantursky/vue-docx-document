// Fails when a change touches the library's source but the changelog has nothing under
// `## [Unreleased]`. Usage: node scripts/changelog-check.js [base-ref]. In CI the base is
// the pull request's target branch; locally it defaults to origin/main.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE_DIR = 'packages/vue-docx-document/src/'
const CHANGELOG = 'packages/vue-docx-document/CHANGELOG.md'

/** The text under `## [Unreleased]`, up to the next `## ` heading, trimmed. */
export function unreleasedEntries(changelog) {
  const match = /^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## |^\[[^\]]+\]: |(?![\s\S]))/m.exec(changelog)
  return match ? match[1].trim() : ''
}

/** Problems for a change: the changed paths and the changelog text. Empty when it is fine. */
export function changelogProblems(changedPaths, changelog) {
  const sourceFiles = changedPaths.filter((path) => path.startsWith(SOURCE_DIR))
  if (sourceFiles.length === 0) return []
  if (unreleasedEntries(changelog) !== '') return []
  return [
    `${sourceFiles.length} file(s) under ${SOURCE_DIR} changed (${sourceFiles[0]}${sourceFiles.length > 1 ? ', …' : ''}), but ${CHANGELOG} has nothing under "## [Unreleased]". Add an entry, or label the pull request "no-changelog".`,
  ]
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(import.meta.dirname, '..')
  const base = process.argv[2] ?? 'origin/main'
  const diff = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' })
  const problems = changelogProblems(diff.split('\n').filter(Boolean), readFileSync(join(root, CHANGELOG), 'utf8'))
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
  console.log('Changelog check passed.')
}
