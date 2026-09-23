import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { normalizePack, type Pack } from '../domain/packs'
import { packFileUrl } from '../domain/settings'
import { clearLearnerProgress, loadLearnerPacks, loadLearnerProgress, loadPack, removeLearnerPack, saveLearnerProgress, upsertLearnerPack } from '../adapters/storage'

type InstallPromptEvent = Event & { prompt: () => Promise<void> }

async function fetchPackFile(url: string): Promise<Pack | undefined> {
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const parsed: unknown = await response.json()
    return normalizePack(parsed) ?? undefined
  } catch {
    return undefined
  }
}

function packSignature(pack: Pack): string {
  return JSON.stringify({ title: pack.title, subject: pack.subject, flashcards: pack.flashcards.map((card) => [card.question, card.answer]) })
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, ReactNode> = {
    books: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
    arrow: <><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

const STREAK_KEY = 'kompas:streak'

function loadStreak(): { days: number; last: string } {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (!raw) return { days: 0, last: '' }
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'days' in parsed && typeof (parsed as { days: unknown }).days === 'number') return parsed as { days: number; last: string }
    return { days: 0, last: '' }
  } catch {
    return { days: 0, last: '' }
  }
}

function markStudyDay(): number {
  const today = new Date().toISOString().slice(0, 10)
  const streak = loadStreak()
  if (streak.last === today) return streak.days
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const days = streak.last === yesterday ? streak.days + 1 : 1
  try { localStorage.setItem(STREAK_KEY, JSON.stringify({ days, last: today })) } catch { /* brak miejsca */ }
  return days
}

function daysLabel(days: number): string {
  return days === 1 ? 'dzień' : 'dni'
}

export function TrybSluchacza({ pakietParam }: { pakietParam: string }) {
  const previewMode = new URLSearchParams(window.location.search).has('podglad')
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.platform))
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  const [screen, setScreen] = useState<'loading' | 'library' | 'runner' | 'error'>('loading')
  const [pack, setPack] = useState<Pack | null>(null)
  const [library, setLibrary] = useState<Pack[]>([])
  const [progress, setProgress] = useState<Record<number, number>>({})
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [sharePack, setSharePack] = useState<Pack | null>(null)
  const [menuPackId, setMenuPackId] = useState<number | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cardIndex, setCardIndex] = useState(0)
  const [knownCount, setKnownCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [progressReady, setProgressReady] = useState(false)
  const [remoteUpdated, setRemoteUpdated] = useState(false)
  const [streak, setStreak] = useState(() => loadStreak().days)
  const [dragX, setDragX] = useState(0)
  const [sourceDialog, setSourceDialog] = useState<{ source: string; legalBasis?: string } | null>(null)
  const dragStartX = useRef<number | null>(null)
  const answering = useRef(false)
  const suppressClick = useRef(0)

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      const trimmed = pakietParam.trim()
      if (trimmed === '') {
        await openLibrary()
        return
      }
      let resolved: Pack | undefined
      const id = Number(trimmed)
      if (Number.isFinite(id)) {
        const remote = await fetchPackFile(packFileUrl(id))
        const local = (await loadLearnerPacks()).find((item) => item.id === id) ?? (previewMode ? await loadPack(id) : undefined)
        if (remote) {
          resolved = remote
          if (local && packSignature(local) !== packSignature(remote)) setRemoteUpdated(true)
        } else {
          resolved = local
        }
      } else {
        resolved = await fetchPackFile(trimmed)
      }
      if (cancelled) return
      if (resolved) {
        await upsertLearnerPack(resolved)
        setPack(resolved)
        setScreen('runner')
      } else {
        setLibrary(await loadLearnerPacks())
        setScreen('error')
      }
    }
    void resolve()
    return () => { cancelled = true }
  }, [pakietParam])

  useEffect(() => {
    if (!pack || screen !== 'runner') return
    let cancelled = false
    void loadLearnerProgress(pack.id).then((savedIndex) => {
      if (!cancelled) {
        setCardIndex(Math.min(savedIndex, Math.max(pack.flashcards.length - 1, 0)))
        setProgressReady(true)
      }
    })
    return () => { cancelled = true }
  }, [pack, screen])

  useEffect(() => {
    if (progressReady && !finished && pack) void saveLearnerProgress(pack.id, cardIndex)
  }, [cardIndex, progressReady, finished, pack])

  async function openLibrary() {
    const packs = await loadLearnerPacks()
    const entries = await Promise.all(packs.map(async (item) => [item.id, await loadLearnerProgress(item.id)] as const))
    setLibrary(packs)
    setProgress(Object.fromEntries(entries))
    setScreen('library')
  }

  function openPack(item: Pack) {
    setPack(item)
    setCardIndex(0)
    setKnownCount(0)
    setFinished(false)
    setRevealed(false)
    setProgressReady(false)
    setDragX(0)
    setRemoteUpdated(false)
    setScreen('runner')
  }

  async function importPackFile(file: File) {
    const parsed: unknown = await file.text().then(JSON.parse).catch(() => null)
    const imported = normalizePack(parsed)
    if (!imported || imported.flashcards.length === 0) return
    await upsertLearnerPack(imported)
    await openLibrary()
  }

  async function deleteFromLibrary(id: number) {
    await removeLearnerPack(id)
    await clearLearnerProgress(id)
    await openLibrary()
  }

  function packUrl(id: number): string {
    return `${window.location.origin}${window.location.pathname}?pakiet=${id}`
  }

  const canShare = typeof (navigator as Navigator & { share?: unknown }).share === 'function'

  async function sharePackLink(item: Pack) {
    const url = packUrl(item.id)
    const nav = navigator as Navigator & { share?: (data: { title: string; text: string; url: string }) => Promise<void> }
    try {
      await nav.share?.({ title: `Kompas Wiedzy — ${item.title}`, text: `Paczka fiszek „${item.title}” (${item.flashcards.length} fiszek)`, url })
    } catch { /* użytkownik anulował */ }
  }

  const cards = pack?.flashcards ?? []
  const card = cards[cardIndex]

  function nextCard(known: boolean) {
    if (known) setKnownCount((current) => current + 1)
    if (cardIndex + 1 >= cards.length) setFinished(true)
    else setCardIndex((current) => current + 1)
    setRevealed(false)
  }

  useEffect(() => {
    if (screen !== 'runner' || finished) return
    const el = document.querySelector('.learner-progress')
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: 'instant' as ScrollBehavior })
  }, [cardIndex, screen, finished])

  function answer(known: boolean) {
    if (answering.current || !card) return
    answering.current = true
    setDragX(known ? 620 : -620)
    setTimeout(() => {
      setStreak(markStudyDay())
      setDragX(0)
      answering.current = false
      nextCard(known)
    }, 210)
  }

  function onCardTouchStart(event: TouchEvent) {
    dragStartX.current = event.touches[0]?.clientX ?? null
  }

  function onCardTouchMove(event: TouchEvent) {
    if (dragStartX.current === null) return
    setDragX((event.touches[0]?.clientX ?? 0) - dragStartX.current)
  }

  function onCardTouchEnd() {
    const dx = dragX
    dragStartX.current = null
    suppressClick.current = Date.now()
    if (Math.abs(dx) > 90) answer(dx > 0)
    else {
      setDragX(0)
      if (Math.abs(dx) <= 10) setRevealed((r) => !r)
    }
  }

  let body
  if (screen === 'loading') {
    body = <main className="learner-main"><p className="kicker">WCZYTYWANIE</p><h1>Pobieranie paczki…</h1><p className="learner-footer">Paczka zostanie zapisana na tym urządzeniu.</p></main>
  } else if (screen === 'error') {
    body = <main className="learner-main"><p className="kicker">BŁĄD</p><h1>Nie udało się pobrać paczki.</h1><p className="learner-footer">Paczka mogła nie zostać jeszcze opublikowana — poproś instruktora o potwierdzenie. Możesz też spróbować ponownie za chwilę.{library.length > 0 && <> <button className="learner-primary" style={{ marginTop: 20 }} onClick={() => void openLibrary()}>Moje paczki</button></>}</p></main>
  } else if (screen === 'library') {
    const totalCards = library.reduce((sum, p) => sum + p.flashcards.length, 0)
    const totalDone = library.reduce((sum, p) => sum + (progress[p.id] !== undefined && p.flashcards.length > 0 ? Math.min(progress[p.id]! + 1, p.flashcards.length) : 0), 0)
    const lastPack = library.length > 0 ? library.reduce((a, b) => (progress[b.id] ?? 0) > (progress[a.id] ?? 0) ? b : a) : null
    const lastDone = lastPack ? (progress[lastPack.id] ?? 0) : 0
    const lastTotal = lastPack?.flashcards.length ?? 0
    const overallPercent = totalCards > 0 ? Math.round((totalDone / totalCards) * 100) : 0
    body = (
      <main className="learner-main">
        <p className="kicker">MOJE PACZKI</p>
        <h1>Biblioteka</h1>
        {streak > 0 && <p className="library-streak"><span className="streak-chip">✦ {streak}</span> {daysLabel(streak)} nauki z rzędu — tak trzymaj!</p>}

        {library.length > 0 && (
          <div className="library-stats">
            <div className="stat-item"><strong>{totalDone}</strong><span>opanowanych</span></div>
            <div className="stat-item"><strong>{totalCards}</strong><span>fiszek</span></div>
            <div className="stat-item"><strong>{overallPercent}%</strong><span>postęp</span></div>
          </div>
        )}

        {lastPack && lastDone < lastTotal && (
          <button className="continue-card" onClick={() => openPack(lastPack)}>
            <span className="continue-label">Kontynuuj</span>
            <strong>{lastPack.title}</strong>
            <span className="continue-progress">{lastDone + 1}/{lastTotal} fiszek</span>
            <span className="continue-arrow"><Icon name="arrow" /></span>
          </button>
        )}

        {installPrompt && <button className="learner-primary install-cta" onClick={() => { void installPrompt.prompt(); setInstallPrompt(null) }}>Zainstaluj aplikację na telefonie</button>}
        {isIOS && !isStandalone && <p className="learner-note">Na iPhonie: w Safari dotknij <strong>Udostępnij</strong> → <strong>„Dodaj do ekranu początkowego”</strong> — aplikacja otworzy się na pełnym ekranie, bez paska przeglądarki.</p>}

        <div className="learner-pack-list">
          {library.length === 0 && <div className="learner-empty-state"><Icon name="books" /><p>Brak pobranych paczek.<br/>Zeskanuj kod QR z plakatu albo wczytaj plik paczki.</p></div>}
          {library.map((item) => {
            const total = item.flashcards.length
            const done = progress[item.id] !== undefined && total > 0 ? Math.min(progress[item.id]! + 1, total) : 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <div
                className="learner-pack pack-menu-wrap" key={item.id} data-pack-color={item.color}
                onContextMenu={(event) => { event.preventDefault(); setMenuPackId(item.id) }}
                onTouchStart={() => { longPressed.current = false; longPressTimer.current = window.setTimeout(() => { longPressed.current = true; setMenuPackId(item.id) }, 550) }}
                onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
                onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
              >
                <button className="learner-pack-open" onClick={() => { if (longPressed.current) { longPressed.current = false; return } openPack(item) }}>
                  <span className="pack-color-dot" style={{ background: `var(--pack-${item.color})` }} />
                  <strong>{item.title}</strong>
                  <span className="pack-progress-bar"><i style={{ width: `${pct}%` }} /></span>
                  <span className="pack-progress-text">{done}/{total} fiszek{pct === 100 ? ' ✓' : ''}</span>
                </button>
                <button className="icon-button" aria-label="Opcje paczki" onClick={() => setMenuPackId(menuPackId === item.id ? null : item.id)}>•••</button>
                {menuPackId === item.id && (
                  <>
                    <div className="menu-backdrop" onClick={() => setMenuPackId(null)} />
                    <div className="pack-menu">
                      <button onClick={() => { setMenuPackId(null); setSharePack(item) }}>Udostępnij</button>
                      <button className="danger" onClick={() => { setMenuPackId(null); void deleteFromLibrary(item.id) }}>Usuń paczkę</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
        <button className="learner-secondary" onClick={() => fileInputRef.current?.click()}>Wczytaj paczkę z pliku (JSON)</button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importPackFile(file); event.currentTarget.value = '' }} />
        <p className="learner-footer">Paczki są zapisywane lokalnie — po instalacji aplikacja działa offline. Przytrzymaj paczkę, aby udostępnić lub usunąć. <a href="/">Panel instruktora</a></p>
      </main>
    )
  } else if (pack && cards.length === 0) {
    body = <main className="learner-main"><p className="kicker">{pack.subject.toUpperCase()}</p><h1>{pack.title}</h1><p className="learner-footer">Ta paczka nie ma jeszcze fiszek.</p></main>
  } else if (finished && pack) {
    const percent = cards.length > 0 ? Math.round((knownCount / cards.length) * 100) : 0
    const message = percent === 100 ? 'Perfekcyjnie!' : percent >= 80 ? 'Świetny wynik!' : percent >= 50 ? 'Dobrze Ci idzie' : 'Warto powtórzyć'
    const ring = 2 * Math.PI * 52
    body = (
      <main className="learner-main">
        <p className="kicker">{pack.subject.toUpperCase()}</p>
        <h1>{pack.title}</h1>
        <article className="flashcard summary-card">
          <svg className="summary-ring" viewBox="0 0 120 120" role="img" aria-label={`Wynik ${percent}%`}>
            <circle className="ring-bg" cx="60" cy="60" r="52" />
            <circle className="ring-fg" cx="60" cy="60" r="52" strokeDasharray={ring} strokeDashoffset={ring * (1 - percent / 100)} />
            <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" className="ring-value">{percent}%</text>
          </svg>
          <h2>{message}</h2>
          <p className="summary-detail">Znasz {knownCount} z {cards.length} fiszek{streak > 0 ? ` · seria ${streak} ${daysLabel(streak)}` : ''}</p>
          <button className="flashcard-button" onClick={() => { setCardIndex(0); setKnownCount(0); setFinished(false); setRevealed(false) }}>Zacznij od nowa</button>
        </article>
        <button className="learner-secondary full-width" onClick={() => void openLibrary()}>Moje paczki</button>
        <p className="learner-footer">Postęp zapisuje się lokalnie na tym urządzeniu.</p>
      </main>
    )
  } else if (pack && card) {
    body = (
      <main className="learner-main">
        {remoteUpdated && <p className="learner-update">✓ Paczka zaktualizowana z zasobu</p>}
        <div className="learner-head-row">
          <div><p className="kicker">{pack.subject.toUpperCase()}</p><h1>{pack.title}</h1></div>
          {streak > 0 && <span className="streak-chip" title="Dni nauki z rzędu">✦ {streak}</span>}
        </div>
        <div className="learner-progress"><span>Fiszka {cardIndex + 1} z {cards.length}</span><div><i style={{ width: `${((cardIndex + 1) / cards.length) * 100}%` }} /></div></div>
        <article
          className={`flashcard ${revealed ? 'revealed' : ''}`}
          style={{ transform: dragX !== 0 ? `translateX(${dragX}px) rotate(${dragX / 24}deg)` : undefined, transition: dragStartX.current !== null ? 'none' : 'transform .22s cubic-bezier(.2,.7,.3,1)' }}
          onTouchStart={onCardTouchStart}
          onTouchMove={onCardTouchMove}
          onTouchEnd={onCardTouchEnd}
          onClick={() => { if (Date.now() - suppressClick.current > 500) setRevealed((r) => !r) }}
        >
          <div className="flashcard-inner">
            <div className="flashcard-face front">
              <span className="flashcard-label">PYTANIE</span>
              <h2>{card.question}</h2>
              <button className="flashcard-button" onClick={(event) => { event.stopPropagation(); setRevealed(true) }}>Pokaż odpowiedź</button>
            </div>
            <div className="flashcard-face back">
              <span className="flashcard-label">ODPOWIEDŹ</span>
              <h2>{card.answer}</h2>
              {(card.source || card.legalBasis) && <small className="flashcard-source" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); setSourceDialog({ source: card.source ?? '', legalBasis: card.legalBasis }) }} onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}><Icon name="books" /><span className="flashcard-source-text">{card.source || card.legalBasis}</span></small>}
              <button className="flashcard-button" onClick={(event) => { event.stopPropagation(); setRevealed(false) }}>Ukryj odpowiedź</button>
            </div>
          </div>
          {dragX > 15 && <span className="swipe-hint right" style={{ opacity: Math.min(1, (dragX - 15) / 70) }}>PAMIĘTAM</span>}
          {dragX < -15 && <span className="swipe-hint left" style={{ opacity: Math.min(1, (-dragX - 15) / 70) }}>NIE PAMIĘTAM</span>}
        </article>
        <div className="learner-actions"><button className="learner-secondary" onClick={() => answer(false)}>Nie pamiętam</button><button className="learner-primary" onClick={() => answer(true)}>Pamiętam <Icon name="arrow" /></button></div>
        <p className="swipe-tip">dotknij kartę, aby odwrócić · ← przesuń, aby ocenić →</p>
        <p className="learner-footer">Postęp zapisuje się lokalnie na tym urządzeniu.</p>
      </main>
    )
  }

  return (
    <div className="learner-shell" data-pack-color={screen === 'runner' ? (pack?.color ?? 'mint') : 'mint'}>
      <header className="learner-top">
        <div className="brand"><div className="brand-mark">K</div><div><strong>kompas</strong><span>wiedzy</span></div></div>
        <div className="learner-top-actions">
          {previewMode && <button className="learner-nav" onClick={() => { window.location.href = '?view=sluchacze' }}>← Panel instruktora</button>}
          {screen === 'runner' && <button className="learner-nav" onClick={() => void openLibrary()}>Moje paczki</button>}
          {screen === 'library' && <span className="offline-label"><span className="sync-dot" /> tryb offline</span>}
        </div>
      </header>
      {body}
      {sharePack && (
        <div className="modal-backdrop" onClick={() => setSharePack(null)}>
          <div className="share-dialog" role="dialog" aria-modal="true" aria-label={`Udostępnij paczkę ${sharePack.title}`} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSharePack(null)}>×</button>
            <p className="kicker">UDOSTĘPNIJ PACZKĘ</p>
            <h2>{sharePack.title}</h2>
            <div className="share-qr"><QRCodeSVG value={packUrl(sharePack.id)} size={200} bgColor="#ffffff" fgColor="#17201f" /></div>
            <p className="share-url">{packUrl(sharePack.id)}</p>
            {canShare && <button className="learner-primary full-width" onClick={() => void sharePackLink(sharePack)}>Udostępnij link…</button>}
          </div>
        </div>
      )}
      {sourceDialog && (
        <div className="modal-backdrop" onClick={() => setSourceDialog(null)}>
          <div className="share-dialog" role="dialog" aria-modal="true" aria-label="Źródło fiszki" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSourceDialog(null)}>×</button>
            <p className="kicker">ŹRÓDŁO FISZKI</p>
            <div className="modal-source source-dialog-content">
              <Icon name="books" />
              <span className="source-dialog-text">
                {sourceDialog.source && <strong>{sourceDialog.source}</strong>}
                {sourceDialog.legalBasis && <><em className="source-dialog-label">Podstawa prawna</em><span className="source-dialog-legal">{sourceDialog.legalBasis}</span></>}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
