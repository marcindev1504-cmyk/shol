import { describe, expect, it } from 'vitest'
import { approveDraft, createFlashcard, createPack, initialPacks, normalizePack, readApprovedQuestions, readPacks, type Pack } from './packs'

type MemoryStorage = Storage & { data: Record<string, string> }

function storage(seed: Record<string, string> = {}): MemoryStorage {
  const data = { ...seed }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value },
    removeItem: (key) => { delete data[key] },
    clear: () => Object.keys(data).forEach((key) => delete data[key]),
    key: (index) => Object.keys(data)[index] ?? null,
    get length() { return Object.keys(data).length },
  } as MemoryStorage
}

describe('pack storage contract', () => {
  it('returns initial packs when storage is empty', () => {
    expect(readPacks(storage())).toEqual(initialPacks)
  })

  it('rejects malformed pack data instead of crashing the app', () => {
    expect(readPacks(storage({ 'kompas:packs': '{"broken":true}' }))).toEqual(initialPacks)
    expect(readPacks(storage({ 'kompas:packs': 'not-json' }))).toEqual(initialPacks)
  })

  it('accepts only an array of approved question ids', () => {
    expect(readApprovedQuestions(storage({ 'kompas:approved': '["q1","q2"]' }))).toEqual(['q1', 'q2'])
    expect(readApprovedQuestions(storage({ 'kompas:approved': '["q1",4]' }))).toEqual([])
  })
})

describe('normalizePack', () => {
  it('accepts a legacy record without flashcards and with cards count', () => {
    const legacy = { id: 7, title: 'Stara paczka', subject: 'Archiwum', cards: 12, updated: 'wczoraj', status: 'Zatwierdzone', color: 'mint' }
    expect(normalizePack(legacy)).toEqual({ id: 7, title: 'Stara paczka', subject: 'Archiwum', updated: 'wczoraj', status: 'Zatwierdzone', color: 'mint', flashcards: [] })
  })

  it('normalizes an exported pack file missing updated and color', () => {
    const exported = { id: 9, title: 'Paczka z NAS', subject: 'Taktyka', status: 'Zatwierdzone', version: '2026-09-20', flashcards: [] }
    expect(normalizePack(exported)).toEqual({ id: 9, title: 'Paczka z NAS', subject: 'Taktyka', updated: '2026-09-20', status: 'Zatwierdzone', color: 'mint', flashcards: [] })
  })

  it('rejects a record with an invalid status', () => {
    const bad = { id: 1, title: 'X', subject: 'Y', updated: 'dziś', status: 'Szkic', color: 'mint' }
    expect(normalizePack(bad)).toBeNull()
    expect(normalizePack(null)).toBeNull()
    expect(normalizePack('pack')).toBeNull()
  })

  it('falls back to initial packs when any stored element is invalid', () => {
    const mixed = JSON.stringify([initialPacks[0], { id: 'bad' }])
    expect(readPacks(storage({ 'kompas:packs': mixed }))).toEqual(initialPacks)
  })
})

describe('approveDraft', () => {
  it('adds the draft as approved to the matching pack and stamps the date', () => {
    const draft = createFlashcard({ question: 'Q?', answer: 'A.', source: 'S', packId: 1 })
    const result = approveDraft(initialPacks, draft, 'dzisiaj, 12:00')
    const pack = result.find((item) => item.id === 1)!
    expect(pack.flashcards.at(-1)).toEqual({ ...draft, status: 'Zatwierdzone' })
    expect(pack.updated).toBe('dzisiaj, 12:00')
    expect(result.find((item) => item.id === 2)!.flashcards).toHaveLength(2)
  })

  it('does not duplicate a flashcard with the same id', () => {
    const draft = createFlashcard({ question: 'Q?', answer: 'A.', source: 'S', packId: 1 })
    const once = approveDraft(initialPacks, draft, 'dzisiaj, 12:00')
    const twice = approveDraft(once, draft, 'dzisiaj, 12:00')
    expect(twice.find((item) => item.id === 1)!.flashcards.filter((card) => card.id === draft.id)).toHaveLength(1)
  })

  it('returns packs unchanged when the target pack does not exist', () => {
    const draft = createFlashcard({ question: 'Q?', answer: 'A.', source: 'S', packId: 99 })
    expect(approveDraft(initialPacks, draft, 'dzisiaj, 12:00')).toBe(initialPacks)
  })
})

describe('createPack', () => {
  it('assigns a unique timestamp id and status Do weryfikacji', () => {
    const before = Date.now()
    const pack = createPack(initialPacks, 'Nowa', 'Temat', 'dzisiaj, 12:00')
    expect(pack.id).toBeGreaterThanOrEqual(before)
    expect(initialPacks.map((p) => p.id)).not.toContain(pack.id)
    expect(pack.status).toBe('Do weryfikacji')
    expect(pack.flashcards).toEqual([])
  })

  it('assigns mint color for an empty list', () => {
    const pack = createPack([] as Pack[], 'Nowa', 'Temat', 'dzisiaj, 12:00')
    expect(pack.color).toBe('mint')
  })
})
