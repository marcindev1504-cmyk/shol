import { useEffect, useRef, useState, type ReactNode } from 'react'

type SectionDef = { id: string; title: string }
type Lightbox = { src: string; alt: string; caption: string }

const SECTIONS: SectionDef[] = [
  { id: 'wprowadzenie', title: 'Wprowadzenie i zasady pracy' },
  { id: 'edytor', title: 'Paczka i edytor fiszek' },
  { id: 'generator', title: 'Generowanie fiszek ze źródła' },
  { id: 'publikacja', title: 'Publikacja i eksport paczki' },
  { id: 'plakat', title: 'Plakat z kodem QR' },
  { id: 'sluchacz', title: 'Aplikacja słuchacza (PWA)' },
  { id: 'nas', title: 'Wdrożenie na zasobie NAS' },
  { id: 'postepy', title: 'Podgląd nauki na urządzeniu' },
  { id: 'ustawienia', title: 'Ustawienia i dane' },
  { id: 'problemy', title: 'Rozwiązywanie problemów' },
]

function Figure({ src, alt, caption, phone, onOpen }: { src: string; alt: string; caption: string; phone?: boolean; onOpen: (figure: Lightbox) => void }) {
  return (
    <figure className={phone ? 'manual-figure phone' : 'manual-figure'}>
      <button className="manual-figure-open" onClick={() => onOpen({ src, alt, caption })} aria-label={`Powiększ zrzut: ${alt}`}>
        <img src={src} alt={alt} loading="lazy" />
        <span className="manual-zoom-hint" aria-hidden="true">⤢</span>
      </button>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

function Section({ id, index, title, children }: { id: string; index: number; title: string; children: ReactNode }) {
  return (
    <section className="manual-section" id={id}>
      <header><span className="manual-number">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3></header>
      {children}
    </section>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return <aside className="manual-tip"><strong>Wskazówka</strong><p>{children}</p></aside>
}

export function InstrukcjaView() {
  const [lightbox, setLightbox] = useState<Lightbox | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const zoomBy = (factor: number) => setZoom((current) => Math.min(5, Math.max(0.5, Math.round(current * factor * 100) / 100)))
  const resetZoom = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }

  useEffect(() => {
    if (!lightbox) return
    resetZoom()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
      if (event.key === '+' || event.key === '=') zoomBy(1.25)
      if (event.key === '-') zoomBy(0.8)
      if (event.key === '0') resetZoom()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox])

  return (
    <div className="manual">
      <header className="manual-hero">
        <p className="kicker">DOKUMENTACJA</p>
        <h3>Instrukcja obsługi — Kompas wiedzy</h3>
        <p className="manual-lead">Kompas wiedzy to lokalny system do tworzenia paczek fiszek i ich dystrybucji. Instruktor tworzy i publikuje paczki, generuje plakat z kodem QR do wyświetlenia np. na telewizorze w akademiku, a paczkę eksportuje na zasób sieciowy. Słuchacz skanuje kod telefonem — aplikacja PWA instaluje się na jego urządzeniu, pobiera paczkę i działa offline.</p>
        <p className="manual-meta">Wersja dokumentacji: 2.0 · dotyczy wersji aplikacji 0.2.0</p>
      </header>

      <nav className="manual-toc" aria-label="Spis treści">
        <p className="kicker">SPIS TREŚCI</p>
        <ol>{SECTIONS.map((section, index) => <li key={section.id}><a href={`#${section.id}`}>{String(index + 1).padStart(2, '0')} · {section.title}</a></li>)}</ol>
      </nav>

      <Section id="wprowadzenie" index={0} title="Wprowadzenie i zasady pracy">
        <p>Aplikacja składa się z dwóch części korzystających z tej samej bazy kodu:</p>
        <ul className="manual-list">
          <li><strong>Panel instruktora</strong> — to, co widzisz teraz. Tworzysz tu paczki, fiszki i materiały dystrybucyjne.</li>
          <li><strong>Aplikacja słuchacza</strong> — minimalistyczny interfejs PWA pod adresem <code>?pakiet=…</code>. Słuchacz nie potrzebuje dostępu do Twojej sieci — wystarczy zasób (np. NAS), na którym leży aplikacja i pliki paczek.</li>
        </ul>
        <p>Twierdze zasady systemu: propozycje powstają <strong>wyłącznie z zatwierdzonych przez Ciebie źródeł</strong>, każda fiszka pokazuje cytat źródłowy, a wszystkie dane są przechowywane lokalnie (IndexedDB) i działają offline dzięki service workerowi.</p>
      </Section>

      <Section id="edytor" index={1} title="Paczka i edytor fiszek">
        <p>Paczka to kontener na fiszki. Kliknij „Nowa paczka” — powstanie paczka robocza i od razu otworzy się jej <strong>edytor</strong>. To centrum całej pracy:</p>
        <Figure src="/docs/edytor.png" alt="Edytor paczki z listą fiszek" caption="Edytor paczki: edytowalny tytuł, lista fiszek i akcje dystrybucji."  onOpen={setLightbox} />
        <ul className="manual-list">
          <li><strong>Tytuł i przedmiot</strong> — kliknij w pole i pisz; zmiany zapisują się automatycznie.</li>
          <li><strong>Edytuj</strong> przy fiszce — popraw pytanie, odpowiedź i źródło w miejscu, „Zapisz fiszkę”.</li>
          <li><strong>＋ Dodaj fiszkę</strong> — pusta fiszka ręczna.</li>
          <li><strong>×</strong> — usuwa fiszkę z paczki.</li>
        </ul>
        <Tip>Wszystko w edytorze można zmieniać w dowolnym momencie — także po publikacji. Paczka jest wersjonowana datą ostatniej zmiany.</Tip>
      </Section>

      <Section id="generator" index={2} title="Generowanie fiszek ze źródła">
        <p>W edytorze paczki kliknij <strong>„✦ Generuj ze źródła”</strong>. Kreator ma dwa kroki:</p>
        <ol className="manual-steps">
          <li><strong>Źródło.</strong> Zaimportuj plik TXT/Markdown albo wybierz wcześniej zapisany dokument. Jeśli dokument nie jest jeszcze zatwierdzony, zaznacz checkbox „Potwierdzam, że dokument jest zatwierdzonym materiałem szkoleniowym”.</li>
          <li><strong>Propozycje.</strong> Generator pokazuje edytowalną listę propozycji z checkboxami — popraw treść, odznacz lub usuń zbędne, a potem „Dodaj zaznaczone”. Fiszki trafiają prosto do paczki.</li>
        </ol>
        <Figure src="/docs/generator.png" alt="Dialog generatora z propozycjami" caption="Krok 2 kreatora: propozycje do edycji i zaznaczania przed dodaniem."  onOpen={setLightbox} />
        <p>Domyślny tryb <strong>deterministyczny</strong> buduje propozycje z literalnych zdań źródła — zero ryzyka halucynacji. Tryb <strong>modelu lokalnego</strong> (ustawisz w Ustawieniach) dodatkowo filtruje każdą odpowiedź przez weryfikację cytatu: propozycja bez potwierdzenia w dokumencie jest automatycznie odrzucana.</p>
      </Section>

      <Section id="publikacja" index={3} title="Publikacja i eksport paczki">
        <p>Paczka robocza (status „◷ Robocza”) staje się opublikowana przyciskiem <strong>„Opublikuj”</strong> w edytorze — wymaga co najmniej jednej fiszki. Publikacja to sygnał „gotowa do dystrybucji”, nie wysyła niczego nigdzie.</p>
        <p>Przycisk <strong>„↓ Eksportuj paczkę”</strong> zapisuje plik <code>kompas-paczka-ID.json</code>. Umieść go na zasobie sieciowym w katalogu <code>paczki/</code> obok zainstalowanej aplikacji — stamtąd pobierze ją aplikacja słuchacza.</p>
        <Figure src="/docs/paczki.png" alt="Widok paczek" caption="Widok „Paczki”: siatka paczek ze statusem i menu akcji (•••)."  onOpen={setLightbox} />
      </Section>

      <Section id="plakat" index={4} title="Plakat z kodem QR">
        <p>Przycisk <strong>„◈ Plakat z QR”</strong> (w edytorze lub w menu paczki) generuje profesjonalny plakat PNG 1080×1350: tytuł paczki, liczba fiszek, duży kod QR i instrukcja dla słuchacza. Pobierz i wyślij na ekran w akademiku.</p>
        <Figure src="/docs/plakat.png" alt="Generator plakatu z kodem QR" caption="Plakat z kodem QR — gotowy do wyświetlenia na telewizorze."  onOpen={setLightbox} />
        <p>Kod QR prowadzi pod adres <code>&lt;adres zasobu&gt;/?pakiet=ID</code>. Adres zasobu (np. adres NAS z aplikacją) ustawisz w <strong>Ustawieniach → Dystrybucja</strong>; bez ustawienia kod wskazuje bieżący adres aplikacji.</p>
        <Tip>Docelowy układ na NAS: katalog aplikacji (zawartość <code>dist/</code>) + podkatalog <code>paczki/</code> z wyeksportowanymi plikami JSON.</Tip>
      </Section>

      <Section id="sluchacz" index={5} title="Aplikacja słuchacza (PWA)">
        <p>Słuchacz skanuje kod telefonem. Przy pierwszym wejściu:</p>
        <ol className="manual-steps">
          <li>Otwiera się aplikacja w przeglądarce i automatycznie pobiera paczkę z zasobu (<code>paczki/kompas-paczka-ID.json</code>).</li>
          <li>Paczka zapisuje się w lokalnej bibliotece urządzenia.</li>
          <li>Przeglądarka może zaproponować instalację (PWA) — w bibliotece jest też przycisk „Zainstaluj aplikację”. Po instalacji wszystko działa offline.</li>
        </ol>
        <p>Nauka jest gestowa: <strong>przesuń kartę w prawo</strong> = „Pamiętam”, <strong>w lewo</strong> = „Nie pamiętam” (albo użyj przycisków pod kartą). „Pokaż odpowiedź” obraca kartę i odkrywa cytat ze źródła. Aplikacja liczy <strong>serię dni nauki</strong> (chip ✦) i po ostatniej fiszce pokazuje podsumowanie z pierścieniem wyniku.</p>
        <p>Kolejne kody QR dopisują nowe paczki do tej samej aplikacji. Przycisk <strong>„Moje paczki”</strong> pokazuje bibliotekę z postępami; paczkę można też wczytać z pliku JSON.</p>
        <p>Przy każdym wejściu przez QR aplikacja najpierw sprawdza wersję na zasobie — jeśli paczka została podmieniona (np. nowa edycja materiału), słuchacz automatycznie dostaje aktualną treść z informacją „Paczka zaktualizowana z zasobu”. Bez sieci używana jest kopia lokalna, a postęp nauki zachowuje się przy aktualizacji.</p>
        <div className="manual-figures-row">
          <Figure phone src="/docs/biblioteka-sluchacza.png" alt="Biblioteka paczek słuchacza" caption="Biblioteka: paczki, postępy, instalacja PWA."  onOpen={setLightbox} />
          <Figure phone src="/docs/tryb-sluchacza.png" alt="Tryb słuchacza na telefonie z fiszką" caption="Fiszka z pytaniem — ocena gestem lub przyciskami."  onOpen={setLightbox} />
          <Figure phone src="/docs/tryb-sluchacza-odpowiedz.png" alt="Odkryta odpowiedź na fiszce" caption="Obrót karty odkrywa odpowiedź ze źródłem."  onOpen={setLightbox} />
          <Figure phone src="/docs/podsumowanie-sluchacza.png" alt="Podsumowanie nauki z pierścieniem wyniku" caption="Podsumowanie: pierścień wyniku i seria dni."  onOpen={setLightbox} />
        </div>
      </Section>

      <Section id="nas" index={6} title="Wdrożenie na zasobie NAS">
        <p>Kod QR nie wskazuje bezpośrednio na plik paczki — wskazuje na <strong>aplikację</strong> leżącą na zasobie. Telefon słuchacza pobiera z NAS całą aplikację, a ona sama doczytuje paczkę JSON. Dlatego na zasobie muszą leżeć dwie rzeczy obok siebie:</p>
        <ol className="manual-steps">
          <li><strong>Aplikacja</strong> — pełna zawartość katalogu <code>dist/</code> (po <code>npm run build</code>): <code>index.html</code>, <code>assets/</code>, <code>manifest.webmanifest</code>, <code>sw.js</code> itd.</li>
          <li><strong>Paczki</strong> — podkatalog <code>paczki/</code> z wyeksportowanymi plikami <code>kompas-paczka-ID.json</code>.</li>
        </ol>
        <p>Przykładowy układ na NAS: <code>http://192.168.1.10/kompas/</code> → aplikacja, <code>http://192.168.1.10/kompas/paczki/kompas-paczka-9.json</code> → paczki. Większość NAS-ów (Synology, QNAP) ma wbudowany serwer WWW — wystarczy wrzucić pliki do udostępnionego katalogu webowego.</p>
        <p>Po wdrożeniu: ustaw adres zasobu w <strong>Ustawieniach → Dystrybucja</strong> (np. <code>http://192.168.1.10/kompas</code>), wyeksportuj paczki do <code>paczki/</code> i generuj plakaty — kody będą prowadzić na zasób.</p>
        <Tip><strong>Instalacja PWA wymaga HTTPS.</strong> Service worker i przycisk „Zainstaluj aplikację” działają tylko w bezpiecznym kontekście (HTTPS lub localhost). Na zwykłym <code>http://</code> aplikacja otworzy się w przeglądarce i paczki zapiszą się lokalnie, ale nie da się jej zainstalować ani działać offline. Rozwiązania: włącz HTTPS na NAS (Synology/QNAP potrafią wystawić certyfikat), reverse proxy z certyfikatem (np. Caddy) albo domena lokalna z wewnętrznym CA.</Tip>
      </Section>

      <Section id="postepy" index={7} title="Postępy słuchaczy">
        <p>Zakładka „Podgląd nauki” pokazuje postępy zapisane w IndexedDB <strong>tego urządzenia</strong>: liczbę opublikowanych paczek, łączną liczbę fiszek oraz paczki z rozpoczętą nauką — dla każdej paczki pasek postępu i status. Służy do sprawdzenia paczki „oczami słuchacza” przed publikacją.</p>
        <Tip>Postępy słuchaczy na ich telefonach nie trafiają do panelu — IndexedDB jest per urządzenie. Zbiorcze monitorowanie grupy wymagałoby backendu na zasobie (endpoint zapisujący postępy), którego statyczny NAS nie zapewnia.</Tip>
        <Figure src="/docs/sluchacze.png" alt="Widok podglądu nauki z paskami postępu paczek" caption="Podgląd nauki: dane z IndexedDB tego urządzenia dla każdej paczki."  onOpen={setLightbox} />
      </Section>

      <Section id="ustawienia" index={8} title="Ustawienia i dane">
        <p>W „Ustawieniach” skonfigurujesz:</p>
        <ul className="manual-list">
          <li><strong>Profil</strong> — imię instruktora (powitanie, awatar) i nazwę jednostki (pasek boczny).</li>
          <li><strong>Dystrybucja</strong> — adres zasobu dla słuchaczy używany w kodach QR (np. <code>http://192.168.1.10/kompas</code>).</li>
          <li><strong>Generator</strong> — domyślny tryb: deterministyczny albo model lokalny.</li>
          <li><strong>Dane</strong> — eksport całości do JSON (kopia zapasowa) i czyszczenie danych (podwójne potwierdzenie).</li>
        </ul>
        <Figure src="/docs/ustawienia.png" alt="Widok ustawień" caption="Ustawienia: profil, adres zasobu, tryb generatora i zarządzanie danymi."  onOpen={setLightbox} />
      </Section>

      <Section id="problemy" index={9} title="Rozwiązywanie problemów">
        <table className="manual-table">
          <thead><tr><th>Objaw</th><th>Przyczyna</th><th>Rozwiązanie</th></tr></thead>
          <tbody>
            <tr><td>QR nie pobiera paczki</td><td>Plik paczki nie leży w <code>paczki/</code> obok aplikacji albo zły adres zasobu w Ustawieniach</td><td>Sprawdź adres zasobu i nazwę pliku (<code>kompas-paczka-ID.json</code>).</td></tr>
            <tr><td>„Model niedostępny…”</td><td>Ollama nie działa albo brak backendu <code>/api/ai/generate</code></td><td>W trybie deweloperskim (npm run dev) uruchom Ollamę (<code>ollama serve</code>) — endpoint wywołuje prawdziwy model (np. qwen3:4b). Na produkcji (NAS) podłącz własny backend albo ustaw tryb deterministyczny w Ustawieniach.</td></tr>
            <tr><td>Nie mogę opublikować paczki</td><td>Paczka nie ma fiszek</td><td>Dodaj fiszkę ręcznie albo wygeneruj ze źródła.</td></tr>
            <tr><td>Aplikacja słuchacza bez internetu</td><td>PWA nie została zainstalowana / SW nie zdążył się zapisać</td><td>Otwórz aplikację raz z siecią, zainstaluj ją, potem działa offline.</td></tr>
            <tr><td>Brak opcji „Zainstaluj aplikację” na telefonie</td><td>Zasób serwuje po zwykłym HTTP — PWA wymaga HTTPS</td><td>Włącz HTTPS na NAS albo użyj reverse proxy z certyfikatem. Szczegóły w sekcji „Wdrożenie na zasobie NAS”.</td></tr>
            <tr><td>Import pliku odrzucony</td><td>Format inny niż TXT/MD/JSON lub treść &lt; 45 znaków</td><td>Konwertuj dokument i sprawdź długość treści.</td></tr>
            <tr><td>Zniknęły dane</td><td>Dane są per przeglądarka (IndexedDB)</td><td>Otwórz w tej samej przeglądarce lub przywróć eksport JSON.</td></tr>
          </tbody>
        </table>
      </Section>

      {lightbox && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label={lightbox.alt}
          onClick={() => setLightbox(null)}
          onWheel={(event) => zoomBy(event.deltaY < 0 ? 1.15 : 0.87)}>
          <figure className={dragging ? 'lightbox-figure dragging' : 'lightbox-figure'} onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-zoom-wrap"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
              onDoubleClick={() => (zoom > 1 ? resetZoom() : zoomBy(2))}
              onPointerDown={(event) => { if (zoom > 1) { dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId) } }}
              onPointerMove={(event) => { if (dragRef.current) setOffset({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y }) }}
              onPointerUp={() => { dragRef.current = null; setDragging(false) }}
              onPointerCancel={() => { dragRef.current = null; setDragging(false) }}>
              <img src={lightbox.src} alt={lightbox.alt} draggable={false} style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }} />
            </div>
            <figcaption>{lightbox.caption}</figcaption>
          </figure>
          <div className="lightbox-controls" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => zoomBy(0.8)} disabled={zoom <= 0.5} aria-label="Pomniejsz">−</button>
            <span className="lightbox-zoom-value">{Math.round(zoom * 100)}%</span>
            <button onClick={() => zoomBy(1.25)} disabled={zoom >= 5} aria-label="Powiększ">+</button>
            <button className="lightbox-reset" onClick={resetZoom} disabled={zoom === 1 && offset.x === 0 && offset.y === 0}>Dopasuj</button>
          </div>
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Zamknij podgląd">×</button>
        </div>
      )}
    </div>
  )
}
