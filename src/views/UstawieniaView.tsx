import { useEffect, useState } from 'react'
import { AI_MODELS, CARDS_PER_SOURCE_OPTIONS, type AppSettings } from '../domain/settings'
import { listOllamaModels, type OllamaStatus } from '../adapters/ai'
import { installPwa, onPwaInstallChange, pwaInstallable, pwaInstalled } from '../adapters/pwa'

type Props = {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onExport: () => void
  onReset: () => void
}

export function UstawieniaView({ settings, onSave, onExport, onReset }: Props) {
  const [instructorName, setInstructorName] = useState(settings.instructorName)
  const [workspaceName, setWorkspaceName] = useState(settings.workspaceName)
  const [shareBaseUrl, setShareBaseUrl] = useState(settings.shareBaseUrl)
  const [generatorMode, setGeneratorMode] = useState(settings.generatorMode)
  const [aiModel, setAiModel] = useState(settings.aiModel)
  const [ollamaHost, setOllamaHost] = useState(settings.ollamaHost)
  const [cardsPerSource, setCardsPerSource] = useState(settings.cardsPerSource)
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)
  const [serverRunning, setServerRunning] = useState<boolean | null>(null)
  const [installable, setInstallable] = useState(pwaInstallable())
  const [installed] = useState(pwaInstalled())

  useEffect(() => onPwaInstallChange(() => setInstallable(pwaInstallable())), [])

  useEffect(() => {
    fetch('/api/control?action=status').then(r => r.json()).then(d => setServerRunning(d.running)).catch(() => setServerRunning(null))
  }, [])

  useEffect(() => {
    if (generatorMode !== 'model') return
    let cancelled = false
    setOllama(null)
    void listOllamaModels(ollamaHost).then((status) => { if (!cancelled) setOllama(status) })
    return () => { cancelled = true }
  }, [generatorMode, aiModel, ollamaHost])

  const effectiveHost = ollamaHost.trim() || 'http://localhost:11434'
  const modelOptions = [...new Set([...(ollama?.reachable ? ollama.models : AI_MODELS), aiModel])]
  const modelStatus = generatorMode !== 'model' ? null
    : ollama === null ? { kind: 'checking', text: `Sprawdzam dostępność modeli pod adresem ${effectiveHost}…` }
    : !ollama.reachable ? { kind: 'error', text: `Ollama nie odpowiada pod adresem ${effectiveHost} — uruchom ją (ollama serve), żeby generowanie modelem działało.` }
    : ollama.models.includes(aiModel) ? { kind: 'ok', text: `✓ Model „${aiModel}” jest dostępny na serwerze.` }
    : { kind: 'error', text: `Model „${aiModel}” nie jest pobrany na serwerze — wykonaj tam: ollama pull ${aiModel}` }

  return (
    <div className="settings-grid">
      <div className="settings-grid-main">
      <section className="settings-card">
        <p className="kicker">PROFIL</p>
        <h3>Instruktor i jednostka</h3>
        <p className="settings-copy">Dane widoczne w powitaniu, awatarze i pasku bocznym.</p>
        <label>Imię i nazwisko instruktora<input value={instructorName} onChange={(event) => setInstructorName(event.target.value)} /></label>
        <label>Nazwa jednostki<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label>
      </section>

      <section className="settings-card">
        <p className="kicker">DYSTRYBUCJA</p>
        <h3>Adres zasobu dla słuchaczy</h3>
        <p className="settings-copy">Adres, pod którym aplikacja jest dostępna dla słuchaczy (np. na NAS). Kody QR na plakatach będą prowadzić pod ten adres.</p>
        <label>Adres bazowy<input value={shareBaseUrl} onChange={(event) => setShareBaseUrl(event.target.value)} placeholder="np. http://192.168.1.10/kompas" /></label>
        <small className="settings-hint">Wrzuć na zasób zbudowaną aplikację (katalog dist/) oraz paczki JSON do podkatalogu paczki/. Puste pole = bieżący adres.</small>
      </section>

      <section className="settings-card">
        <p className="kicker">DANE APLIKACJI</p>
        <h3>Kopia i czyszczenie</h3>
        <p className="settings-copy">Paczki, źródła i postępy są przechowywane lokalnie w IndexedDB tej przeglądarki — nic nie trafia do chmury.</p>
        <div className="settings-actions">
          <button className="outline-button" onClick={onExport}>Eksportuj wszystkie dane (JSON)</button>
          <button className="danger-button" onClick={onReset}>Wyczyść wszystkie dane</button>
        </div>
        <small className="settings-hint">Czyszczenie usuwa paczki, źródła, ustawienia i postępy słuchaczy. Po operacji aplikacja uruchomi się od nowa z danymi startowymi.</small>
      </section>

      {serverRunning !== null && (
      <section className="settings-card">
        <p className="kicker">SERWER</p>
        <h3>Sterowanie aplikacją</h3>
        <p className="settings-copy">Zatrzymanie wyłącza serwer i kończy działanie aplikacji. Ponowne uruchomienie przez skrót „Kompas Wiedzy” (START.bat).</p>
        <div className="settings-actions">
          {serverRunning ? (
            <button className="danger-button" onClick={async () => { try { await fetch('/api/control?action=stop') } catch { /* serwer może już być wyłączony */ } setServerRunning(false) }}>
              Zatrzymaj
            </button>
          ) : (
            <span className="settings-copy">Serwer wyłączony. Uruchom aplikację ponownie przez skrót „Kompas Wiedzy”.</span>
          )}
          <span className={`model-status ${serverRunning ? 'ok' : 'error'}`}>{serverRunning ? '● Aplikacja działa' : '● Aplikacja zatrzymana'}</span>
        </div>
      </section>
      )}

      <div className="settings-save-bar">
        <button className="primary-button settings-save" onClick={() => onSave({ instructorName, workspaceName, shareBaseUrl, generatorMode, aiModel, ollamaHost: ollamaHost.trim().replace(/\/+$/, ''), cardsPerSource })}>Zapisz ustawienia</button>
      </div>
      </div>

      <div className="settings-grid-side">
      <section className="settings-card">
        <p className="kicker">INFORMACJE</p>
        <h3>O tej instalacji <span className="version-badge">v0.2.0</span></h3>
        <dl className="settings-facts">
          <div><dt>Tryb pracy</dt><dd>Lokalny · offline (PWA)</dd></div>
          <div><dt>Magazyn danych</dt><dd>IndexedDB „kompas-wiedzy”</dd></div>
          <div><dt>Synchronizacja</dt><dd>Brak — dane nie opuszczają urządzenia</dd></div>
        </dl>
      </section>

      <section className="settings-card">
        <p className="kicker">GENERATOR</p>
        <h3>Tryb generowania</h3>
        <p className="settings-copy">Deterministyczny tworzy propozycje z literalnych zdań źródła. Model lokalny korzysta z /api/ai/generate — w trybie deweloperskim endpoint wywołuje prawdziwy LLM przez Ollamę (wymagane: ollama serve). Może to być Ollama na innym komputerze w sieci. Na produkcji (NAS) podłącz własny backend pod ten sam kontrakt.</p>
        <label>Tryb<select value={generatorMode} onChange={(event) => setGeneratorMode(event.target.value as AppSettings['generatorMode'])}><option value="deterministic">Deterministyczny (cytaty)</option><option value="model">Model lokalny (beta)</option></select></label>
        {generatorMode === 'model' && <>
          <label>Adres serwera Ollama<input value={ollamaHost} onChange={(event) => setOllamaHost(event.target.value)} placeholder="puste = http://localhost:11434" /></label>
          <label>Model Ollamy<select value={aiModel} onChange={(event) => setAiModel(event.target.value)}>{modelOptions.map((model) => <option value={model} key={model}>{model}{ollama?.reachable ? ollama.models.includes(model) ? ' ✓ pobrany' : ' — niepobrany' : ''}</option>)}</select></label>
          {modelStatus && <small className={`model-status ${modelStatus.kind}`}>{modelStatus.text}</small>}
          <small className="settings-hint">Zdalny serwer: Ollama musi nasłuchiwać na interfejsie sieciowym — uruchom ją tam z OLLAMA_HOST=0.0.0.0. Większy model = lepsze cytaty i pytania, wolniejsze generowanie.</small>
        </>}
        <label>Maks. fiszek ze źródła<select value={cardsPerSource} onChange={(event) => setCardsPerSource(Number(event.target.value))}>{CARDS_PER_SOURCE_OPTIONS.map((count) => <option value={count} key={count}>{count}</option>)}</select></label>
      </section>

      <section className="settings-card">
        <p className="kicker">INSTALACJA</p>
        <h3>Aplikacja na komputerze</h3>
        <p className="settings-copy">Zainstaluj Kompas Wiedzy jako aplikację — własne okno i ikona w menu Start, bez paska przeglądarki.</p>
        <div className="settings-actions">
          {installed ? (
            <span className="model-status ok">● Aplikacja zainstalowana</span>
          ) : installable ? (
            <button className="primary-button" onClick={() => void installPwa()}>Zainstaluj aplikację</button>
          ) : (
            <span className="settings-copy">Instalacja niedostępna — otwórz aplikację w Edge lub Chrome i użyj ikony instalacji w pasku adresu.</span>
          )}
        </div>
      </section>
      </div>
    </div>
  )
}
