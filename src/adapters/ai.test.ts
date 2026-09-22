import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateAiDraft, type AiDraftRequest } from './ai'

const request: AiDraftRequest = { sourceTitle: 'Ustawa o Policji', sourceVersion: '2026-01-01', sourceContent: 'Treść dokumentu źródłowego.' }

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('generateAiDraft', () => {
  it('wysyła POST z treścią źródła na /api/ai/generate', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ cards: [] })))
    vi.stubGlobal('fetch', fetchMock)
    await generateAiDraft(request, 7)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/ai/generate')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ ...request, targetCards: 8 })
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('mapuje kartę modelu na fiszkę z packId i statusem Do weryfikacji', async () => {
    mockFetch(() => jsonResponse({ cards: [{ question: 'Pytanie?', answer: 'Odpowiedź ze źródła.', source: 'Ustawa, art. 1' }] }))
    const cards = await generateAiDraft(request, 7)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ question: 'Pytanie?', answer: 'Odpowiedź ze źródła.', source: 'Ustawa, art. 1', status: 'Do weryfikacji', packId: 7 })
    expect(cards[0]!.id).toBeTruthy()
  })

  it('podstawia źródło z dokumentu, gdy model go nie zwrócił', async () => {
    mockFetch(() => jsonResponse({ cards: [{ question: 'P?', answer: 'A.' }] }))
    const cards = await generateAiDraft(request, 7)
    expect(cards[0]!.source).toBe('Ustawa o Policji, wersja 2026-01-01')
  })

  it('odrzuca odpowiedź bez tablicy cards', async () => {
    mockFetch(() => jsonResponse({ foo: 'bar' }))
    await expect(generateAiDraft(request, 7)).rejects.toThrow('nieprawidłowy format')
  })

  it('odrzuca kartę bez pytania lub odpowiedzi', async () => {
    mockFetch(() => jsonResponse({ cards: [{ question: 'Pytanie?' }] }))
    await expect(generateAiDraft(request, 7)).rejects.toThrow('nieprawidłowy format')
  })

  it('przekazuje komunikat błędu z backendu', async () => {
    mockFetch(() => jsonResponse({ error: 'Model jest przeciążony.' }, 503))
    await expect(generateAiDraft(request, 7)).rejects.toThrow('Model jest przeciążony.')
  })

  it('zwraca sensowny błąd dla HTTP bez pola error', async () => {
    mockFetch(() => jsonResponse({}, 500))
    await expect(generateAiDraft(request, 7)).rejects.toThrow('nie odpowiedział')
  })

  it('propaguje błąd sieci (brak backendu)', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(generateAiDraft(request, 7)).rejects.toBeInstanceOf(TypeError)
  })
})
