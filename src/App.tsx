import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPack, formatUpdatedLabel, initialPacks, normalizePack, packColorLabels, packColors, packColorSymbols, type Flashcard, type Pack } from './domain/packs'
import type { Source } from './domain/sources'
import { defaultSettings, firstName, greeting, initials, packShareUrl, type AppSettings } from './domain/settings'
import { clearAllData, clearLearnerProgress, exportAllData, loadAllProgress, loadAppSettings, loadPacks, loadSources, migrateLegacyStorage, saveAppSettings, savePacks, saveSources } from './adapters/storage'
import { ConfirmDialog, type ConfirmOptions } from './views/ConfirmDialog'
import { EdytorPaczkiView } from './views/EdytorPaczkiView'
import { GeneratorDialog } from './views/GeneratorDialog'
import { InstrukcjaView } from './views/InstrukcjaView'
import { PlakatDialog } from './views/PlakatDialog'
import { SluchaczeView } from './views/SluchaczeView'
import { TrybSluchacza } from './views/TrybSluchacza'
import { UstawieniaView } from './views/UstawieniaView'

function Icon({ name }: { name: string }) {
  const icons: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    books: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
    spark: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    settings: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
    help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    arrow: <><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

const VIEW_SLUGS: Record<string, string> = { paczki: 'Paczki', przeglad: 'Paczki', biblioteka: 'Paczki', generator: 'Paczki', sluchacze: 'Podgląd nauki', nauka: 'Podgląd nauki', ustawienia: 'Ustawienia', instrukcja: 'Instrukcja' }
const VIEW_TO_SLUG = new Map([['Paczki', 'paczki'], ['Podgląd nauki', 'sluchacze'], ['Ustawienia', 'ustawienia'], ['Instrukcja', 'instrukcja']])

function App() {
  const urlParams = new URLSearchParams(window.location.search)
  const [activeView, setActiveViewState] = useState(() => VIEW_SLUGS[urlParams.get('view') ?? ''] ?? 'Paczki')
  const [packs, setPacks] = useState<Pack[]>(initialPacks)
  const [sources, setSources] = useState<Source[]>([])
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [progress, setProgress] = useState<Record<number, number>>({})
  const [storageReady, setStorageReady] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [menuPackId, setMenuPackId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [editingPackId, setEditingPackId] = useState<number | null>(null)
  const [generatorPack, setGeneratorPack] = useState<Pack | null>(null)
  const [posterPack, setPosterPack] = useState<Pack | null>(null)
  const [creatingPack, setCreatingPack] = useState(false)
  const [newPackTitle, setNewPackTitle] = useState('')
  const [newPackSubject, setNewPackSubject] = useState('')
  const [newPackColor, setNewPackColor] = useState<Pack['color']>('mint')
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const packFileInputRef = useRef<HTMLInputElement>(null)

  function askConfirm(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve }))
  }

  function syncUrl(params: Record<string, string | null>) {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) next.set(key, value)
    const query = next.toString()
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }

  function setActiveView(view: string) {
    setActiveViewState(view)
    setEditingPackId(null)
    syncUrl({ view: view === 'Paczki' ? null : VIEW_TO_SLUG.get(view) ?? null })
  }

  function openEditor(packId: number) {
    setEditingPackId(packId)
    syncUrl({ paczka: String(packId) })
  }

  function closeEditor() {
    setEditingPackId(null)
    syncUrl({ view: activeView === 'Paczki' ? null : VIEW_TO_SLUG.get(activeView) ?? null })
  }

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      await migrateLegacyStorage()
      const [storedPacks, storedSources, storedSettings] = await Promise.all([loadPacks(), loadSources(), loadAppSettings()])
      if (cancelled) return
      setPacks(storedPacks)
      setSources(storedSources)
      setSettings(storedSettings)
      setProgress(await loadAllProgress(storedPacks.map((pack) => pack.id)))
      const editorParam = new URLSearchParams(window.location.search).get('paczka') ?? new URLSearchParams(window.location.search).get('podglad')
      const editorId = Number(editorParam)
      if (editorParam && Number.isFinite(editorId) && storedPacks.some((pack) => pack.id === editorId)) setEditingPackId(editorId)
      setStorageReady(true)
    }
    void hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (activeView === 'Podgląd nauki') void loadAllProgress(packs.map((pack) => pack.id)).then(setProgress)
  }, [activeView, packs])

  const packSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!storageReady) return
    if (packSaveTimer.current) clearTimeout(packSaveTimer.current)
    packSaveTimer.current = setTimeout(() => { void savePacks(packs) }, 400)
  }, [packs, storageReady])

  const sourceSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!storageReady) return
    if (sourceSaveTimer.current) clearTimeout(sourceSaveTimer.current)
    sourceSaveTimer.current = setTimeout(() => { void saveSources(sources) }, 400)
  }, [sources, storageReady])

  useEffect(() => {
    if (storageReady) void saveAppSettings(settings)
  }, [settings, storageReady])

  const filteredPacks = useMemo(() => packs.filter((pack) => `${pack.title} ${pack.subject}`.toLowerCase().includes(query.toLowerCase())), [packs, query])
  const editingPack = editingPackId !== null ? packs.find((pack) => pack.id === editingPackId) ?? null : null

  function updatePack(next: Pack) {
    setPacks((current) => current.map((pack) => pack.id === next.id ? next : pack))
  }

  function openCreatePack() {
    setNewPackTitle('')
    setNewPackSubject('')
    setNewPackColor('mint')
    setCreatingPack(true)
  }

  function createNewPack() {
    const title = newPackTitle.trim()
    if (!title) return
    const pack = { ...createPack(packs, title, newPackSubject.trim() || 'Materiał szkoleniowy', formatUpdatedLabel()), color: newPackColor }
    setPacks((current) => [...current, pack])
    setCreatingPack(false)
    openEditor(pack.id)
    setNotice(`Utworzono paczkę „${pack.title}”. Dodaj fiszki ręcznie albo wygeneruj je ze źródła.`)
  }

  async function importPackFile(file: File) {
    const parsed: unknown = await file.text().then(JSON.parse).catch(() => null)
    const imported = normalizePack(parsed)
    if (!imported || imported.flashcards.length === 0) {
      setNotice('Nie udało się wczytać paczki — plik nie jest wyeksportowaną paczką Kompas Wiedzy albo nie zawiera fiszek.')
      return
    }
    const id = packs.length ? Math.max(...packs.map((pack) => pack.id)) + 1 : 1
    const pack: Pack = { ...imported, id, flashcards: imported.flashcards.map((card) => ({ ...card, packId: id })) }
    setPacks([...packs, pack])
    setNotice(`Zaimportowano paczkę „${pack.title}” (${pack.flashcards.length} fiszek). Sprawdź fiszki i opublikuj, gdy będzie gotowa.`)
  }

  function downloadPack(pack: Pack) {
    const payload = { id: pack.id, title: pack.title, subject: pack.subject, status: pack.status, updated: pack.updated, color: pack.color, version: new Date().toISOString().slice(0, 10), flashcards: pack.flashcards }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kompas-paczka-${pack.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice(`Wyeksportowano „${pack.title}”. Wrzuć plik do katalogu paczki/ na zasobie NAS.`)
  }

  async function deletePack(pack: Pack) {
    if (!await askConfirm({ title: 'Usunąć paczkę?', message: `„${pack.title}” zostanie usunięta wraz z ${pack.flashcards.length} fiszkami i postępami nauki na tym urządzeniu.`, confirmLabel: 'Usuń paczkę', danger: true })) return
    setPacks(packs.filter((item) => item.id !== pack.id))
    void clearLearnerProgress(pack.id)
    setProgress((current) => { const next = { ...current }; delete next[pack.id]; return next })
    setMenuPackId(null)
    if (editingPackId === pack.id) closeEditor()
    setNotice(`Usunięto paczkę „${pack.title}”.`)
  }

  const addGeneratedCards = useCallback((cards: Flashcard[]) => {
    if (!generatorPack) return
    const packId = generatorPack.id
    const packTitle = generatorPack.title
    setPacks((current) => current.map((pack) =>
      pack.id === packId ? { ...pack, flashcards: [...pack.flashcards, ...cards], updated: formatUpdatedLabel() } : pack
    ))
    setNotice(`Dodano ${cards.length} fiszek do paczki „${packTitle}”.`)
  }, [generatorPack])

  async function exportBackup() {
    const url = URL.createObjectURL(new Blob([await exportAllData()], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `kompas-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Wyeksportowano kopię wszystkich danych do pliku JSON.')
  }

  async function resetAllData() {
    if (!await askConfirm({ title: 'Usunąć wszystkie dane?', message: 'Paczki, źródła, ustawienia i postępy nauki zapisane na tym urządzeniu zostaną trwale usunięte.', confirmLabel: 'Usuń wszystko', danger: true, checkLabel: 'Rozumiem, że operacja jest nieodwracalna.' })) return
    await clearAllData()
    window.location.href = window.location.pathname
  }

  function saveSettings(next: AppSettings) {
    setSettings(next)
    setNotice('Ustawienia zapisane.')
  }

  const pakietParam = urlParams.get('pakiet')
  if (import.meta.env.MODE === 'learner') return <TrybSluchacza pakietParam={pakietParam ?? ''} />
  if (pakietParam !== null) return <TrybSluchacza pakietParam={pakietParam} />
  if (!storageReady) return <div className="app-loading"><div className="brand"><div className="brand-mark">K</div><div><strong>kompas</strong><span>wiedzy</span></div></div><p>Łączenie z lokalnym magazynem danych…</p></div>

  const todayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  const totalCards = packs.reduce((sum, pack) => sum + pack.flashcards.length, 0)
  const draftPacks = packs.filter((pack) => pack.status === 'Do weryfikacji').length

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">K</div><div><strong>kompas</strong><span>wiedzy</span></div></div>
        <div className="workspace-switcher"><span className="eyebrow">WORKSPACE</span><strong>{settings.workspaceName}</strong><span className="chevron">⌄</span></div>
        <nav className="nav-list">
          <span className="nav-label">PRZESTRZEŃ ROBOCZA</span>
          {['Paczki', 'Podgląd nauki'].map((item, index) => <button className={activeView === item && !editingPack ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(item)} key={item} title={item}><Icon name={['books', 'users'][index]} />{item}</button>)}
          <span className="nav-label lower">SYSTEM</span>
          {['Ustawienia', 'Instrukcja'].map((item, index) => <button className={activeView === item ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(item)} key={item} title={item}><Icon name={['settings', 'help'][index]} />{item}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="sync-dot" /><div><strong>System lokalny</strong><span>Zapis lokalny aktywny</span></div><button className="icon-button" aria-label="Przejdź do ustawień" onClick={() => setActiveView('Ustawienia')}>•••</button></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>{settings.workspaceName}</span><b>/</b><strong>{editingPack ? editingPack.title : activeView}</strong></div><div className="top-actions"><div className="system-status"><span className="status-pulse" />Tryb lokalny · <strong>offline</strong></div><div className="avatar">{initials(settings.instructorName)}</div></div></header>
        <div className="content-wrap">
          {notice && <div className="notice"><Icon name="check" />{notice}<button onClick={() => setNotice('')} aria-label="Zamknij">×</button></div>}

          {editingPack ? (
            <EdytorPaczkiView
              pack={editingPack}
              onBack={closeEditor}
              onUpdate={updatePack}
              onGenerate={() => setGeneratorPack(editingPack)}
              onPoster={() => setPosterPack(editingPack)}
              onDownload={() => downloadPack(editingPack)}
              onDelete={() => deletePack(editingPack)}
            />
          ) : (
            <>
              <section className="hero-row"><div><p className="kicker">{todayLabel}</p><h1>{greeting()}, {firstName(settings.instructorName)}.</h1><p className="hero-copy">Twoja biblioteka: <strong>{packs.length} paczek, {totalCards} fiszek</strong>.</p></div><div className="hero-actions"><button className="outline-button" onClick={() => packFileInputRef.current?.click()}>Importuj paczkę</button><button className="primary-button" onClick={openCreatePack}><Icon name="plus" />Nowa paczka</button></div><input ref={packFileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importPackFile(file); event.currentTarget.value = '' }} /></section>

              {activeView !== 'Paczki' && <section className="workspace-panel">
                <div className="workspace-panel-head"><div><p className="kicker">{activeView === 'Ustawienia' ? 'KONFIGURACJA' : activeView === 'Instrukcja' ? 'POMOC' : 'NA TYM URZĄDZENIU'}</p><h2>{activeView}</h2><p>{activeView === 'Ustawienia' ? 'Profil instruktora, adres zasobu i zarządzanie danymi.' : activeView === 'Instrukcja' ? 'Kompletny przewodnik po wszystkich funkcjach systemu.' : 'Postępy nauki zapisane na tym urządzeniu — sprawdź, jak paczka wygląda dla słuchacza.'}</p></div><span className="confidence">LOKALNIE · BEZ CHMURY</span></div>
                {activeView === 'Podgląd nauki' && <SluchaczeView packs={packs} progress={progress} onOpenPack={(pack) => { window.location.href = `?pakiet=${pack.id}&podglad=1` }} />}
                {activeView === 'Ustawienia' && <UstawieniaView settings={settings} onSave={saveSettings} onExport={() => void exportBackup()} onReset={() => void resetAllData()} />}
                {activeView === 'Instrukcja' && <InstrukcjaView />}
              </section>}

              {activeView === 'Paczki' && <>
                <section className="stats-grid"><div className="stat-card accent"><div className="stat-top"><span>PACZKI</span><Icon name="books" /></div><strong>{packs.length}</strong><p>w bibliotece</p></div><div className="stat-card"><div className="stat-top"><span>FISZKI ŁĄCZNIE</span><Icon name="grid" /></div><strong>{totalCards}</strong><p>kart we wszystkich paczkach</p></div><div className="stat-card"><div className="stat-top"><span>PACZKI ROBOCZE</span><Icon name="spark" /></div><strong>{draftPacks}</strong><p>oczekują na publikację</p></div></section>

                <section className="section-head"><div><p className="kicker">TWOJE MATERIAŁY</p><h2>Paczki</h2></div></section>
                <div className="toolbar"><div className="search-box"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj paczki lub przedmiotu..." /></div><div className="view-toggle"><button className={viewMode === 'grid' ? 'selected' : ''} onClick={() => setViewMode('grid')} aria-label="Widok siatki"><Icon name="grid" /></button><button className={viewMode === 'list' ? 'selected' : ''} onClick={() => setViewMode('list')} aria-label="Widok listy"><Icon name="list" /></button></div></div>
                <section className={viewMode === 'grid' ? 'pack-grid' : 'pack-grid list'}>{filteredPacks.map((pack) => <article className="pack-card" key={pack.id} onClick={() => openEditor(pack.id)}><div className={`pack-art ${pack.color}`}><span>{pack.subject}</span><div className="art-symbol">{packColorSymbols[pack.color]}</div></div><div className="pack-body"><div className="pack-meta"><span className={pack.status === 'Zatwierdzone' ? 'status approved' : 'status review'}>{pack.status === 'Zatwierdzone' ? '✓ Opublikowana' : '◷ Robocza'}</span><span className="pack-menu-wrap"><button className="more-button" aria-label="Więcej opcji" onClick={(event) => { event.stopPropagation(); setMenuPackId((current) => current === pack.id ? null : pack.id) }}>•••</button>{menuPackId === pack.id && <><span className="menu-backdrop" onClick={(event) => { event.stopPropagation(); setMenuPackId(null) }} /><span className="pack-menu"><button onClick={(event) => { event.stopPropagation(); openEditor(pack.id) }}>Otwórz edytor</button><button onClick={(event) => { event.stopPropagation(); setPosterPack(pack); setMenuPackId(null) }}>Plakat z QR</button><button onClick={(event) => { event.stopPropagation(); downloadPack(pack); setMenuPackId(null) }}>Eksportuj JSON</button><button className="danger" onClick={(event) => { event.stopPropagation(); deletePack(pack) }}>Usuń paczkę</button></span></>}</span></div><h3>{pack.title}</h3><p>{pack.flashcards.length} fiszek <span>·</span> aktualizacja {pack.updated}</p><div className="pack-footer"><button className="mini-action" onClick={(event) => { event.stopPropagation(); setPosterPack(pack) }} aria-label="Plakat z QR"><Icon name="download" /></button></div></div></article>)}</section>
              </>}
            </>
          )}
        </div>
      </main>

      {generatorPack && <GeneratorDialog pack={generatorPack} sources={sources} generatorMode={settings.generatorMode} aiModel={settings.aiModel} ollamaHost={settings.ollamaHost} cardsPerSource={settings.cardsPerSource} onSourceCreated={(source) => setSources((current) => [...current, source])} onApproveSource={(id) => setSources((current) => current.map((source) => source.id === id ? { ...source, approved: true } : source))} onAdd={addGeneratedCards} onClose={() => setGeneratorPack(null)} />}
      {posterPack && <PlakatDialog pack={posterPack} shareUrl={packShareUrl(posterPack.id, settings)} onClose={() => setPosterPack(null)} />}
      {confirmState && <ConfirmDialog {...confirmState} onResult={(ok) => { confirmState.resolve(ok); setConfirmState(null) }} />}
      {creatingPack && (
        <div className="modal-backdrop" onClick={() => setCreatingPack(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setCreatingPack(false)}>×</button>
            <p className="kicker">NOWY MATERIAŁ</p>
            <h2>Nowa paczka</h2>
            <p className="modal-copy">Nazwij paczkę i wybierz okładkę — fiszki dodasz później ręcznie albo wygenerujesz ze źródła.</p>
            <label>Nazwa paczki<input value={newPackTitle} onChange={(event) => setNewPackTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createNewPack() }} placeholder="np. Legitymowanie i ustalanie tożsamości" autoFocus /></label>
            <label>Temat<input value={newPackSubject} onChange={(event) => setNewPackSubject(event.target.value)} placeholder="np. Podstawy służby" /></label>
            <label>Okładka<div className="color-picker">{packColors.map((color) => <button type="button" key={color} className={newPackColor === color ? 'selected' : ''} onClick={() => setNewPackColor(color)}><span className={`swatch ${color}`} />{packColorLabels[color]}</button>)}</div></label>
            <button className="primary-button full create-pack-submit" disabled={!newPackTitle.trim()} onClick={createNewPack}>Utwórz paczkę</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
