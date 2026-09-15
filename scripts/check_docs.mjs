import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8'
}).split('\0').filter(Boolean)
const knownFiles = new Set(files.map((file) => file.replaceAll('\\', '/')))
const docs = files.filter((file) => file.endsWith('.md'))
const failures = []
let checked = 0

for (const file of docs) {
  // Ignore fenced examples, and check file targets rather than Markdown heading anchors.
  const text = readFileSync(path.join(root, file), 'utf8').replace(/```[\s\S]*?```/g, '')
  for (const match of text.matchAll(/\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1].replace(/^<|>$/g, '')
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(href)) continue
    const target = decodeURIComponent(href.split(/[?#]/)[0])
    if (!target) continue
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target))
    checked += 1
    if (!knownFiles.has(resolved) && !files.some((entry) => entry.startsWith(`${resolved}/`))) {
      failures.push(`${file}: ${href} -> ${resolved} is not in the publishable file set`)
    }
  }
}

console.log(`Checked ${docs.length} Markdown files and ${checked} local file links`)
for (const failure of failures) console.error(failure)
if (failures.length) process.exitCode = 1
