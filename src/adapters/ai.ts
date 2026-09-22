import { createFlashcard, type Flashcard } from '../domain/packs'

export type AiDraftRequest = {
  sourceTitle: string
  sourceVersion: string
  sourceContent: string
  model?: string
  ollamaHost?: string
}

export type GenerateOptions = {
  maxCards?: number
  onProgress?: (done: number, total: number) => void
}

export type OllamaStatus = { reachable: boolean; models: string[] }

const CARDS_PER_CHUNK = 8
const CHUNK_SIZE = 4000

export async function listOllamaModels(ollamaHost?: string): Promise<OllamaStatus> {
  try {
    const url = ollamaHost?.trim() ? `/api/ai/models?host=${encodeURIComponent(ollamaHost.trim())}` : '/api/ai/models'
    const response = await fetch(url)
    if (!response.ok) return { reachable: false, models: [] }
    const payload: unknown = await response.json()
    const models = payload && typeof payload === 'object' && 'models' in payload && Array.isArray(payload.models) ? payload.models.filter((item): item is string => typeof item === 'string') : []
    return { reachable: true, models }
  } catch {
    return { reachable: false, models: [] }
  }
}

function chunkSource(content: string, maxChunks: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const paragraph of content.split(/\n+/).map((line) => line.trim()).filter(Boolean)) {
    if (current && current.length + paragraph.length + 1 > CHUNK_SIZE) {
      chunks.push(current)
      current = ''
    }
    current = current ? `${current}\n${paragraph}` : paragraph
    while (current.length > CHUNK_SIZE) {
      chunks.push(current.slice(0, CHUNK_SIZE))
      current = current.slice(CHUNK_SIZE)
    }
  }
  if (current) chunks.push(current)
  if (chunks.length <= maxChunks) return chunks
  return Array.from({ length: maxChunks }, (_, index) => chunks[Math.floor(index * chunks.length / maxChunks)]!)
}

async function requestCards(request: AiDraftRequest & { targetCards: number }): Promise<unknown[]> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : 'Lokalny model nie odpowiedział.'
    throw new Error(message)
  }
  if (!payload || typeof payload !== 'object' || !('cards' in payload) || !Array.isArray(payload.cards)) throw new Error('Model zwrócił nieprawidłowy format.')
  return payload.cards
}

export async function generateAiDraft(request: AiDraftRequest, packId: number, options: GenerateOptions = {}): Promise<Flashcard[]> {
  const maxCards = Math.max(1, options.maxCards ?? CARDS_PER_CHUNK)
  const chunks = chunkSource(request.sourceContent, Math.ceil(maxCards / CARDS_PER_CHUNK))
  const fallbackSource = `${request.sourceTitle}, wersja ${request.sourceVersion}`
  const cards: Flashcard[] = []
  const seen = new Set<string>()

  for (let index = 0; index < chunks.length && cards.length < maxCards; index++) {
    options.onProgress?.(index + 1, chunks.length)
    let chunkCards: unknown[]
    try {
      chunkCards = await requestCards({ ...request, sourceContent: chunks[index]!, targetCards: CARDS_PER_CHUNK })
    } catch (err) {
      if (cards.length === 0) throw err
      break
    }
    for (const card of chunkCards) {
      const draft = card && typeof card === 'object' ? card as { question?: unknown; answer?: unknown; source?: unknown } : {}
      if (typeof draft.question !== 'string' || typeof draft.answer !== 'string') throw new Error('Model zwrócił nieprawidłowy format.')
      const key = draft.answer.replace(/\s+/g, ' ').trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      cards.push(createFlashcard({ question: draft.question, answer: draft.answer, source: typeof draft.source === 'string' ? draft.source : fallbackSource, status: 'Do weryfikacji', packId }))
      if (cards.length >= maxCards) break
    }
  }
  return cards
}
