import { useMemo, useState } from 'react'
import { createFlashcard, type Flashcard, type Pack } from '../domain/packs'
import { containsQuote, createSource, detectLegalBasis, draftsFromSource, makeLegalBasisLookup, type Source } from '../domain/sources'
import { generateAiDraft } from '../adapters/ai'

type Props = {
  pack: Pack
  sources: Source[]
  generatorMode: 'deterministic' | 'model'
  aiModel: string
  ollamaHost?: string
  cardsPerSource: number
  onSourceCreated: (source: Source) => void
  onApproveSource: (sourceId: string) => void
  onAdd: (cards: Flashcard[]) => void
  onClose: () => void
}

type Proposal = { id: string; checked: boolean; question: string; answer: string; source: string; legalBasis?: string; packId: number }

function toProposal(card: Flashcard): Proposal {
  return { id: card.id, checked: true, question: card.question, answer: card.answer, source: card.source, legalBasis: card.legalBasis, packId: card.packId }
}

export function GeneratorDialog({ pack, sources, generatorMode, aiModel, ollamaHost, cardsPerSource, onSourceCreated, onApproveSource, onAdd, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rejectedCount, setRejectedCount] = useState(0)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const contentKey = (source: Source) => source.content.replace(/\s+/g, ' ').trim().toLowerCase()
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>()
    return sources.filter((s) => { const ok = !seen.has(contentKey(s)); seen.add(contentKey(s)); return ok })
  }, [sources])
  const selectedSource = uniqueSources.find((source) => source.id === selectedSourceId)
  const legalBasis = useMemo(
    () => selectedSource?.legalBasis || (selectedSource ? detectLegalBasis(selectedSource.content) : ''),
    [selectedSource]
  )
  const readyToGenerate = !!selectedSource && (selectedSource.approved || confirmed)

  async function importFile(file: File) {
    setError('')
    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.md')) {
      setError('Obsługiwane formaty to TXT i Markdown.')
      return
    }
    const content = await file.text()
    if (content.trim().length < 45) {
      setError('Dokument jest zbyt krótki, aby utworzyć bezpieczne propozycje.')
      return
    }
    const normalized = content.replace(/\s+/g, ' ').trim().toLowerCase()
    const existing = sources.find((source) => contentKey(source) === normalized)
    if (existing) {
      setSelectedSourceId(existing.id)
      setConfirmed(false)
      return
    }
    const source = createSource(file.name, content)
    onSourceCreated(source)
    setSelectedSourceId(source.id)
  }

  async function generate() {
    if (!selectedSource) return
    setBusy(true)
    setError('')
    setProgress(null)
    try {
      if (confirmed && !selectedSource.approved) onApproveSource(selectedSource.id)
      let cards: Flashcard[]
      if (generatorMode === 'model') {
        const generated = await generateAiDraft({ sourceTitle: selectedSource.title, sourceVersion: selectedSource.version, sourceContent: selectedSource.content, model: aiModel, ollamaHost }, pack.id, { maxCards: cardsPerSource, onProgress: (done, total) => setProgress({ done, total }) })
        const legalBasisFor = makeLegalBasisLookup(selectedSource.content)
        cards = generated.filter((card) => containsQuote(selectedSource, card.answer)).map((card) => ({ ...card, legalBasis: legalBasisFor(card.answer) || undefined }))
        setRejectedCount(generated.length - cards.length)
      } else {
        cards = draftsFromSource({ ...selectedSource, legalBasis: legalBasis || undefined }, pack.id, cardsPerSource)
        setRejectedCount(0)
      }
      if (cards.length === 0) {
        setError(generatorMode === 'model' ? 'Model nie zwrócił żadnej propozycji potwierdzonej cytatem w źródle.' : 'Nie znaleziono zdań odpowiednich do fiszek (min. 45 znaków).')
        return
      }
      setProposals(cards.map(toProposal))
      setStep(2)
    } catch (err) {
      const friendly = 'Lokalny model niedostępny (brak backendu /api/ai/generate). Zmień tryb generatora w Ustawieniach na deterministyczny.'
      setError(err instanceof Error && !(err instanceof TypeError) && !(err instanceof SyntaxError) ? err.message : friendly)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function updateProposal(id: string, field: 'question' | 'answer' | 'source' | 'legalBasis', value: string) {
    setProposals((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  const checked = proposals.filter((item) => item.checked)

  function addChecked() {
    onAdd(checked.map((item) => createFlashcard({ question: item.question.trim(), answer: item.answer.trim(), source: item.source.trim(), legalBasis: item.legalBasis?.trim() || undefined, packId: pack.id })))
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal generator-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <p className="kicker">GENERATOR · PACZKA „{pack.title.toUpperCase()}”</p>
        <h2>{step === 1 ? 'Generuj fiszki ze źródła' : 'Przejrzyj propozycje'}<span className={generatorMode === 'model' ? 'ai-badge' : 'ai-badge muted'}><svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>{generatorMode === 'model' ? `AI · ${aiModel}` : 'reguły · cytaty'}</span></h2>

        {step === 1 && <>
          <p className="modal-copy">Wybierz dokument źródłowy — propozycje powstaną wyłącznie z jego treści (maks. {cardsPerSource} fiszek). Tryb: <strong>{generatorMode === 'model' ? `model lokalny (${aiModel})` : 'deterministyczny (cytaty)'}</strong>.</p>
          <label className="file-button">＋ Importuj plik TXT / Markdown<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = '' }} /></label>
          <div className="source-list">{uniqueSources.length === 0 && <small>Brak zapisanych źródeł — zaimportuj pierwszy dokument.</small>}{uniqueSources.map((source) => <button className={selectedSourceId === source.id ? 'source-select selected' : 'source-select'} onClick={() => { setSelectedSourceId(source.id); setConfirmed(false); setError('') }} key={source.id}><b>{source.title}</b><span>{source.approved ? '✓ zatwierdzone' : '◷ wymaga potwierdzenia'} · wersja {source.version}</span></button>)}</div>
          {selectedSource && !selectedSource.approved && <label className="confirm-source"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Potwierdzam, że dokument jest zatwierdzonym materiałem szkoleniowym.</span></label>}
          {selectedSource && legalBasis && <p className="legal-basis-note">Podstawa prawna wykryta w dokumencie: <em>{legalBasis}</em></p>}
          {error && <p className="form-error">{error}</p>}
          <button className={busy ? 'primary-button full busy' : 'primary-button full'} disabled={!readyToGenerate || busy} onClick={() => void generate()}>{busy ? `Analizuję źródło…${progress && progress.total > 1 ? ` część ${progress.done}/${progress.total}` : ''}` : 'Generuj propozycje'}</button>
        </>}

        {step === 2 && <>
          <p className="modal-copy">Zaznacz, popraw lub usuń propozycje. Zapisanie doda je do paczki — możesz je edytować później w edytorze.{rejectedCount > 0 ? ` Odrzucono automatycznie ${rejectedCount} bez potwierdzenia w źródle.` : ''}</p>
          <div className="proposal-list">
            {proposals.map((item, index) => (
              <div className={item.checked ? 'proposal' : 'proposal unchecked'} key={item.id}>
                <input type="checkbox" checked={item.checked} onChange={(event) => setProposals((current) => current.map((p) => p.id === item.id ? { ...p, checked: event.target.checked } : p))} aria-label={`Zaznacz propozycję ${index + 1}`} />
                <div className="proposal-body">
                  <textarea value={item.question} onChange={(event) => updateProposal(item.id, 'question', event.target.value)} rows={1} placeholder="Pytanie" />
                  <textarea value={item.answer} onChange={(event) => updateProposal(item.id, 'answer', event.target.value)} rows={3} placeholder="Odpowiedź" />
                  <input value={item.source} onChange={(event) => updateProposal(item.id, 'source', event.target.value)} placeholder="Źródło" />
                  <input value={item.legalBasis ?? ''} onChange={(event) => updateProposal(item.id, 'legalBasis', event.target.value)} placeholder="Podstawa prawna (opcjonalnie — pokaże się słuchaczowi)" />
                </div>
                <button className="icon-button" aria-label="Usuń propozycję" onClick={() => setProposals((current) => current.filter((p) => p.id !== item.id))}>×</button>
              </div>
            ))}
            {proposals.length === 0 && <small>Wszystkie propozycje usunięte. Wróć i wygeneruj ponownie.</small>}
          </div>
          <div className="generator-footer">
            <button className="outline-button" onClick={() => setStep(1)}>← Wróć do źródła</button>
            <button className="primary-button" disabled={checked.length === 0} onClick={addChecked}>Dodaj zaznaczone ({checked.length})</button>
          </div>
        </>}
      </div>
    </div>
  )
}
