import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./dist', import.meta.url))
const PORT = Number(process.env.PORT ?? 8080)
const OLLAMA = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

function buildSystemPrompt(targetCards) {
  return `Jesteś generatorem fiszek edukacyjnych dla szkolenia zawodowego. Na podstawie DOKUMENTU ŹRÓDŁOWEGO tworzysz propozycje fiszek.

ŻELAZNE ZASADY:
- "question": naturalne, konkretne pytanie po polsku (np. "Jakie uprawnienie ma osoba legitymowana?", "Kiedy policjant może legitymować?"). NIGDY nie używaj formuł typu "Co wynika z fragmentu N".
- "answer": DOSŁOWNY, NIEZMIENIONY cytat z dokumentu — pełne zdanie skopiowane 1:1, bez skracania, bez parafrazowania, bez dodawania słów.
- Twórz dokładnie ${targetCards} fiszek (tyle ile to możliwe, maks. ${targetCards}), każda o innym aspekcie dokumentu.
- Odpowiadasz WYŁĄCZNIE poprawnym JSON-em, bez żadnego komentarza ani markdown.

Format: {"cards": [{"question": "...", "answer": "..."}]}`
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function resolveOllamaHost(value) {
  if (typeof value !== 'string' || !value.trim()) return OLLAMA
  const host = value.trim().replace(/\/+$/, '')
  let url
  try {
    url = new URL(host)
  } catch {
    throw new Error(`Nieprawidłowy adres serwera Ollama: „${host}”.`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Adres serwera Ollama musi zaczynać się od http:// lub https://.')
  return host
}

async function ollamaModels(ollamaHost = OLLAMA) {
  const response = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(5000) })
  const tags = await response.json()
  const models = Array.isArray(tags?.models) ? tags.models.map((item) => item?.name).filter((name) => typeof name === 'string') : []
  return models
}

async function generateWithOllama(sourceTitle, sourceVersion, sourceContent, requestedModel, ollamaHost = OLLAMA, targetCards = 8) {
  let model = requestedModel || process.env.OLLAMA_MODEL
  if (!model) {
    const models = await ollamaModels(ollamaHost)
    model = models[0]
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
  const data = await response.json()
  const content = typeof data?.message?.content === 'string' ? data.message.content : ''
  let parsed = null
  try { parsed = JSON.parse(content) } catch { /* fall through to regex */ }
  if (!parsed) {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) { try { parsed = JSON.parse(match[0]) } catch (err) { throw new Error(`Model zwrócił niepoprawny JSON: ${err instanceof Error ? err.message : err}`) } }
  }
  if (!parsed || !Array.isArray(parsed.cards)) throw new Error(`Model zwrócił nieprawidłowy format. Odpowiedź: ${content.slice(0, 120)}`)
  return parsed.cards
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk; if (body.length > 5_000_000) req.destroy() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

let appRunning = true

const stoppedPage = `<!doctype html>
<html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kompas Wiedzy — zatrzymana</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#101515;color:#e0e0e0;text-align:center}
.card{max-width:400px;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{opacity:.7;margin-bottom:1.5rem}
button{background:#4ade80;color:#101515;border:none;padding:.75rem 2rem;border-radius:.5rem;font-size:1rem;cursor:pointer}
button:hover{background:#22c55e}</style></head><body>
<div class="card"><h1>Kompas Wiedzy</h1><p>Aplikacja jest zatrzymana.</p>
<button onclick="fetch('/api/control?action=start').then(()=>location.reload())">Uruchom</button></div>
</body></html>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/control') {
    const action = url.searchParams.get('action')
    if (action === 'status') return sendJson(res, 200, { running: appRunning })
    if (action === 'stop') { appRunning = false; return sendJson(res, 200, { running: false }) }
    if (action === 'start') { appRunning = true; return sendJson(res, 200, { running: true }) }
    return sendJson(res, 400, { error: 'Nieznana akcja.' })
  }

  if (!appRunning) {
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(stoppedPage)
    return
  }

  if (url.pathname === '/api/ai/models') {
    try {
      sendJson(res, 200, { models: await ollamaModels(resolveOllamaHost(url.searchParams.get('host'))) })
    } catch (err) {
      const invalidHost = err instanceof Error && err.message.includes('Ollama')
      sendJson(res, invalidHost ? 400 : 503, { error: invalidHost ? err.message : 'Ollama nie odpowiada.' })
    }
    return
  }

  if (url.pathname === '/api/ai/generate') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Metoda niedozwolona.' })
    try {
      const request = JSON.parse(await readBody(req))
      if (typeof request?.sourceContent !== 'string' || request.sourceContent.trim().length < 45) return sendJson(res, 400, { error: 'Model nie otrzymał treści źródła.' })
      const targetCards = typeof request.targetCards === 'number' && request.targetCards > 0 ? Math.min(request.targetCards, 40) : 8
      const cards = await generateWithOllama(String(request.sourceTitle ?? 'dokument'), String(request.sourceVersion ?? ''), request.sourceContent, typeof request.model === 'string' ? request.model : undefined, resolveOllamaHost(request.ollamaHost), targetCards)
      sendJson(res, 200, { cards })
    } catch (err) {
      const message = err instanceof SyntaxError ? 'Nieprawidłowe zapytanie.' : err instanceof Error ? `Model niedostępny: ${err.message} Uruchom Ollamę (ollama serve).` : 'Model niedostępny.'
      sendJson(res, 503, { error: message })
    }
    return
  }

  try {
    const pathname = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
    const filePath = join(ROOT, pathname === '' ? 'index.html' : pathname)
    if (!filePath.startsWith(ROOT)) throw new Error('forbidden')
    const content = await readFile(filePath).catch(() => readFile(join(ROOT, 'index.html')))
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    res.end(content)
  } catch {
    res.writeHead(404).end('Not found')
  }
})

server.listen(PORT, () => console.log(`Kompas Wiedzy → http://localhost:${PORT}  (Ollama: ${OLLAMA})`))
