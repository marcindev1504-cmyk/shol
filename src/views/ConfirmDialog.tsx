import { useEffect, useState } from 'react'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  checkLabel?: string
}

export function ConfirmDialog({ title, message, confirmLabel, danger, checkLabel, onResult }: ConfirmOptions & { onResult: (confirmed: boolean) => void }) {
  const [checked, setChecked] = useState(!checkLabel)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onResult(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onResult])

  return (
    <div className="modal-backdrop" onClick={() => onResult(false)}>
      <div className={danger ? 'modal confirm-modal danger' : 'modal confirm-modal'} role="alertdialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => onResult(false)} aria-label="Zamknij">×</button>
        <p className="kicker">{danger ? 'Uwaga · nieodwracalne' : 'Potwierdzenie'}</p>
        <h2>{title}</h2>
        <p className="modal-copy">{message}</p>
        {checkLabel && (
          <label className="confirm-source">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            <span>{checkLabel}</span>
          </label>
        )}
        <div className="confirm-actions">
          <button className="outline-button" onClick={() => onResult(false)}>Anuluj</button>
          <button className={danger ? 'danger-button solid' : 'primary-button'} disabled={!checked} onClick={() => onResult(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
