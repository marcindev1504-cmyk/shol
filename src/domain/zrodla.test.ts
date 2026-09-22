import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createSource, draftsFromSource, sourceSentences } from './sources'

const ROOT = join(process.cwd(), 'zrodla')

function collectTxtFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? collectTxtFiles(path) : path.endsWith('.txt') ? [path] : []
  })
}

const files = collectTxtFiles(ROOT)

describe('biblioteka źródeł zrodla/', () => {
  it('zawiera pliki źródłowe', () => {
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  it.each(files.map((file) => [file.split(/[\\/]/).slice(-2).join('/'), file] as const))(
    '%s daje co najmniej 3 propozycje fiszek',
    (_label, file) => {
      const content = readFileSync(file, 'utf-8')
      const source = createSource(file.split(/[\\/]/).pop()!, content)
      expect(sourceSentences(source).length).toBeGreaterThanOrEqual(3)
      const drafts = draftsFromSource(source, 1, 5)
      expect(drafts.length).toBeGreaterThanOrEqual(3)
      for (const draft of drafts) {
        expect(draft.question.endsWith('?') || draft.question.endsWith('”')).toBe(true)
        expect(draft.answer.length).toBeGreaterThanOrEqual(45)
      }
    },
  )
})
