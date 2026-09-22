import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const OLLAMA = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

function buildSystemPrompt(targetCards: number): string {
  return `Jesteś generatorem fiszek edukacyjnych dla szkolenia zawodowego. Na podstawie DOKUMENTU ŹRÓDŁOWEGO tworzysz propozycje fiszek.

ŻELAZNE ZASADY:
- "question": naturalne, konkretne pytanie po polsku (np. "Jakie uprawnienie ma osoba legitymowana?", "Kiedy policjant może legitymować?"). NIGDY nie używaj formuł typu "Co wynika z fragmentu N".
- "answer": DOSŁOWNY, NIEZMIENIONY cytat z dokumentu — pełne zdanie skopiowane 1:1, bez skracania, bez parafrazowania, bez dodawania słów.
- Twórz dokładnie ${targetCards} fiszek (tyle ile to możliwe, maks. ${targetCards}), każda o innym aspekcie dokumentu.
- Odpowiadasz WYŁĄCZNIE poprawnym JSON-em, bez żadnego komentarza ani markdown.

Format: {"cards": [{"question": "...", "answer": "..."}]}`
}

function resolveOllamaHost(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return OLLAMA
  const host = value.trim().replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(host)
  } catch {
    throw new Error(`Nieprawidłowy adres serwera Ollama: „${host}”.`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Adres serwera Ollama musi zaczynać się od http:// lub https://.')
  return host
}

async function generateWithOllama(sourceTitle: string, sourceVersion: string, sourceContent: string, requestedModel: string | undefined, ollamaHost: string, targetCards = 8) {
  let model = requestedModel || process.env.OLLAMA_MODEL
  if (!model) {
    const tagsResponse = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const tags: unknown = await tagsResponse.json()
    const models = tags && typeof tags === 'object' && 'models' in tags ? (tags as { models?: { name?: string }[] }).models : undefined
    model = models?.[0]?.name
    if (!model) throw new Error('Brak modelu w Ollama. Pobierz np.: ollama pull qwen3:4b')
  }

  const response = await fetch(`${ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(600000),
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: 'json',
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: buildSystemPrompt(targetCards) },
        { role: 'user', content: `Dokument „${sourceTitle}” (wersja ${sourceVersion}):\n\n${sourceContent}` },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Ollama odpowiedziała błędem HTTP ${response.status}.`)
  const data: unknown = await response.json()
  const content = data && typeof data === 'object' && 'message' in data ? (data as { message?: { content?: string } }).message?.content ?? '' : ''
  let parsed: unknown = null
  try { parsed = JSON.parse(content) } catch { /* fall through to regex */ }
  if (!parsed) {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) { try { parsed = JSON.parse(match[0]) } catch (err) { throw new Error(`Model zwrócił niepoprawny JSON: ${err instanceof Error ? err.message : err}`) } }
  }
  if (!parsed || typeof parsed !== 'object' || !('cards' in parsed) || !Array.isArray((parsed as { cards?: unknown }).cards)) throw new Error(`Model zwrócił nieprawidłowy format. Odpowiedź: ${content.slice(0, 120)}`)
  return (parsed as { cards: unknown[] }).cards
}

function localAi(): Plugin {
  return {
    name: 'local-ai-ollama',
    configureServer(server) {
      server.middlewares.use('/api/ai/models', (req: Connect.IncomingMessage, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        void (async () => {
          let ollamaHost: string
          try {
            ollamaHost = resolveOllamaHost(new URL(req.url ?? '/', 'http://localhost').searchParams.get('host'))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Nieprawidłowy adres serwera Ollama.' }))
            return
          }
          try {
            const tagsResponse = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(5000) })
            const tags: unknown = await tagsResponse.json()
            const models = tags && typeof tags === 'object' && 'models' in tags ? (tags as { models?: { name?: unknown }[] }).models : []
            res.end(JSON.stringify({ models: (models ?? []).map((item) => item?.name).filter((name): name is string => typeof name === 'string') }))
          } catch {
            res.statusCode = 503
            res.end(JSON.stringify({ error: 'Ollama nie odpowiada.' }))
          }
        })()
      })
      server.middlewares.use('/api/ai/generate', (req: Connect.IncomingMessage, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Metoda niedozwolona.' }))
          return
        }
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          void (async () => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            try {
              const parsed: unknown = JSON.parse(body)
              const request = parsed && typeof parsed === 'object' ? parsed as { sourceTitle?: unknown; sourceVersion?: unknown; sourceContent?: unknown; model?: unknown; ollamaHost?: unknown; targetCards?: unknown } : {}
              if (typeof request.sourceContent !== 'string' || request.sourceContent.trim().length < 45) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Model nie otrzymał treści źródła.' }))
                return
              }
              const targetCards = typeof request.targetCards === 'number' && request.targetCards > 0 ? Math.min(request.targetCards, 40) : 8
              const cards = await generateWithOllama(String(request.sourceTitle ?? 'dokument'), String(request.sourceVersion ?? ''), request.sourceContent, typeof request.model === 'string' ? request.model : undefined, resolveOllamaHost(request.ollamaHost), targetCards)
              res.end(JSON.stringify({ cards }))
            } catch (err) {
              if (!res.headersSent) res.statusCode = 503
              const message = err instanceof SyntaxError ? 'Nieprawidłowe zapytanie.' : err instanceof Error ? `Model niedostępny: ${err.message} Uruchom Ollamę (ollama serve).` : 'Model niedostępny.'
              res.end(JSON.stringify({ error: message }))
            }
          })()
        })
      })
    },
  }
}

export default defineConfig({
  base: '/shol/',
  plugins: [react(), localAi()],
})
