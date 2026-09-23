import { useEffect, useState } from 'react'
import { createFlashcard, formatUpdatedLabel, packColors, packColorLabels, packColorSymbols, type Flashcard, type Pack } from '../domain/packs'
import { AutoGrowTextarea } from './GeneratorDialog'

type Props = {
  pack: Pack
  onBack: () => void
  onUpdate: (pack: Pack) => void
  onGenerate: () => void
  onPoster: () => void
  onDownload: () => void
  onDelete: () => void
}

type Draft = { question: string; answer: string; source: string; legalBasis: string }

export function EdytorPaczkiView({ pack, onBack, onUpdate, onGenerate, onPoster, onDownload, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>({ question: '', answer: '', source: '', legalBasis: '' })
  const [savedAt, setSavedAt] = useState(0)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setShowSaved(true)
    const t = setTimeout(() => setShowSaved(false), 2200)
    return () => clearTimeout(t)
  }, [savedAt])

  function triggerUpdate(next: Pack) {
    onUpdate(next)
    setSavedAt(Date.now())
  }

  function updatePack(flashcards: Flashcard[]) {
    triggerUpdate({ ...pack, flashcards, updated: formatUpdatedLabel() })
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id)
    setDraft({ question: card.question, answer: card.answer, source: card.source, legalBasis: card.legalBasis ?? '' })
  }

  function startAdd() {
    setEditingId('new')
    setDraft({ question: '', answer: '', source: pack.title, legalBasis: '' })
  }

  function saveEdit() {
    if (!draft.question.trim() || !draft.answer.trim()) return
    if (editingId === 'new') {
      updatePack([...pack.flashcards, createFlashcard({ ...draft, question: draft.question.trim(), answer: draft.answer.trim(), source: draft.source.trim(), legalBasis: draft.legalBasis.trim() || undefined, packId: pack.id })])
    } else {
      updatePack(pack.flashcards.map((card) => card.id === editingId ? { ...card, ...draft, question: draft.question.trim(), answer: draft.answer.trim(), source: draft.source.trim(), legalBasis: draft.legalBasis.trim() || undefined } : card))
    }
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function removeCard(cardId: string) {
    updatePack(pack.flashcards.filter((card) => card.id !== cardId))
    if (editingId === cardId) setEditingId(null)
  }

  const published = pack.status === 'Zatwierdzone'

  return (
    <div className="pack-editor">
      <header className="editor-top">
        <button className="text-button" onClick={onBack}>← Paczki</button>
        <div className="editor-actions">
          <button className="outline-button ai-trigger" onClick={onGenerate}><svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>Generuj ze źródła</button>
          <button className="outline-button" onClick={startAdd}>＋ Dodaj fiszkę</button>
          <button className="outline-button" onClick={onDownload}>↓ Eksportuj paczkę</button>
          <button className="outline-button" onClick={onPoster}>◈ Plakat z QR</button>
          <button className="danger-button" onClick={onDelete}>Usuń</button>
        </div>
      </header>

      <section className="editor-head">
        <div className={`pack-art mini ${pack.color}`}><div className="art-symbol">{packColorSymbols[pack.color]}</div><span className="art-tag">{pack.subject}</span></div>
        <div className="editor-title">
          <input className="editor-title-input" value={pack.title} onChange={(event) => triggerUpdate({ ...pack, title: event.target.value })} aria-label="Tytuł paczki" />
          <input className="editor-subject-input" value={pack.subject} onChange={(event) => triggerUpdate({ ...pack, subject: event.target.value })} aria-label="Przedmiot" />
          <div className="editor-color-strip" role="group" aria-label="Kolor okładki">
            {packColors.map((color) => (
              <button key={color} type="button" className={`editor-color-dot ${color}${pack.color === color ? ' active' : ''}`} title={packColorLabels[color]} aria-label={packColorLabels[color]} aria-pressed={pack.color === color} onClick={() => triggerUpdate({ ...pack, color })} />
            ))}
          </div>
        </div>
        <div className="editor-publish">
          <span className={published ? 'status approved' : 'status review'}>{published ? '✓ Opublikowana' : '◷ Robocza'}</span>
          <button className="primary-button" disabled={pack.flashcards.length === 0 || published} onClick={() => triggerUpdate({ ...pack, status: 'Zatwierdzone' })}>{published ? 'Opublikowano' : 'Opublikuj'}</button>
        </div>
      </section>

      <p className="editor-meta">{pack.flashcards.length} fiszek · aktualizacja {pack.updated}{published ? ' · gotowa do dystrybucji (plakat / eksport)' : ''}{showSaved && <span className="save-indicator"> · Zapisano</span>}</p>

      <section className="card-editor-list">
        {pack.flashcards.length === 0 && <div className="card-empty">Brak fiszek. Dodaj ręcznie („＋ Dodaj fiszkę”) albo wygeneruj ze źródła.</div>}
        {editingId === 'new' && (
          <div className="card-editor editing">
            <span className="card-index">#nowa</span>
            <label>Pytanie<textarea value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} rows={2} autoFocus /></label>
            <label>Odpowiedź<textarea value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} rows={3} /></label>
            <label>Źródło<AutoGrowTextarea value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} /></label>
            <label>Podstawa prawna <em>(opcjonalnie — pokaże się słuchaczowi)</em><AutoGrowTextarea value={draft.legalBasis} onChange={(event) => setDraft((current) => ({ ...current, legalBasis: event.target.value }))} placeholder="np. art. 15 ustawy o Policji" /></label>
            <div className="card-editor-actions">
              <button className="primary-button" disabled={!draft.question.trim() || !draft.answer.trim()} onClick={saveEdit}>Zapisz fiszkę</button>
              <button className="outline-button" onClick={cancelEdit}>Anuluj</button>
            </div>
          </div>
        )}
        {pack.flashcards.map((card, index) => editingId === card.id ? (
          <div className="card-editor editing" key={card.id}>
            <span className="card-index">#{index + 1}</span>
            <label>Pytanie<textarea value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} rows={2} autoFocus /></label>
            <label>Odpowiedź<textarea value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} rows={3} /></label>
            <label>Źródło<AutoGrowTextarea value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} /></label>
            <label>Podstawa prawna <em>(opcjonalnie — pokaże się słuchaczowi)</em><AutoGrowTextarea value={draft.legalBasis} onChange={(event) => setDraft((current) => ({ ...current, legalBasis: event.target.value }))} placeholder="np. art. 15 ustawy o Policji" /></label>
            <div className="card-editor-actions">
              <button className="primary-button" disabled={!draft.question.trim() || !draft.answer.trim()} onClick={saveEdit}>Zapisz fiszkę</button>
              <button className="outline-button" onClick={cancelEdit}>Anuluj</button>
            </div>
          </div>
        ) : (
          <div className="card-editor" key={card.id}>
            <span className="card-index">#{index + 1}</span>
            <div className="card-editor-copy">
              <strong>{card.question}</strong>
              <p>{card.answer}</p>
              <small>{card.source}</small>
              {card.legalBasis && <span className="legal-basis-chip">{card.legalBasis}</span>}
            </div>
            <div className="card-editor-side">
              <button className="outline-button" onClick={() => startEdit(card)}>Edytuj</button>
              <button className="icon-button" aria-label="Usuń fiszkę" onClick={() => removeCard(card.id)}>×</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
