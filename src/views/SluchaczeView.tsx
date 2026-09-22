import type { Pack } from '../domain/packs'

type Props = {
  packs: Pack[]
  progress: Record<number, number>
  onOpenPack: (pack: Pack) => void
}

export function SluchaczeView({ packs, progress, onOpenPack }: Props) {
  const totalCards = packs.reduce((sum, pack) => sum + pack.flashcards.length, 0)
  const published = packs.filter((pack) => pack.status === 'Zatwierdzone').length
  const started = packs.filter((pack) => progress[pack.id] !== undefined && pack.flashcards.length > 0).length

  return (
    <div>
      <p className="learner-note">Postępy pochodzą z lokalnej pamięci <strong>tego urządzenia</strong> — służą do sprawdzenia paczki „oczami słuchacza” przed publikacją. Postępy na telefonach słuchaczy nie trafiają do panelu (wymagałoby to backendu na zasobie).</p>
      <div className="learner-summary">
        <div><strong>{published}</strong><span>opublikowanych paczek</span></div>
        <div><strong>{totalCards}</strong><span>fiszek w paczkach</span></div>
        <div><strong>{started}</strong><span>paczek z rozpoczętą nauką</span></div>
      </div>
      <div className="library-list">
        {packs.map((pack) => {
          const savedIndex = progress[pack.id]
          const total = pack.flashcards.length
          const done = savedIndex !== undefined && total > 0 ? Math.min(savedIndex + 1, total) : 0
          const percent = total > 0 ? Math.round((done / total) * 100) : 0
          return (
            <div className="library-row" key={pack.id}>
              <div className={`library-dot ${pack.color}`} />
              <div>
                <strong>{pack.title}</strong>
                <span>{pack.subject} · {total} fiszek</span>
                {savedIndex === undefined
                  ? <span className="progress-note">Nauka nie rozpoczęta na tym urządzeniu.</span>
                  : <span className="progress-note">Postęp: fiszka {done} z {total} ({percent}%)</span>}
                {total > 0 && <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>}
              </div>
              <span className={pack.status === 'Zatwierdzone' ? 'status approved' : 'status review'}>{pack.status}</span>
              <button className="outline-button" onClick={() => onOpenPack(pack)}>Otwórz jako słuchacz</button>
            </div>
          )
        })}
        {packs.length === 0 && <div className="library-row"><span>Brak paczek. Utwórz pierwszą paczkę w Generatorze AI.</span></div>}
      </div>
    </div>
  )
}
