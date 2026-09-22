# Kompas wiedzy

Prototyp lokalnego systemu do tworzenia, weryfikowania i dystrybucji paczek edukacyjnych dla szkolnictwa policyjnego.

## Założenia produktu

- AI pracuje wyłącznie na wskazanych, zatwierdzonych źródłach.
- Model tworzy propozycje, nigdy nie publikuje treści samodzielnie.
- Każda propozycja pokazuje źródło i czeka na decyzję instruktora.
- Paczki są wersjonowane i mogą być pobierane przez QR oraz używane offline.
- Interfejs jest przygotowany jako panel desktopowy dla instruktora i późniejszy moduł PWA dla słuchacza.

## Start

Wymagany jest Node.js 20+ oraz npm.

```bash
npm install
npm run dev
```

Kompilacja produkcyjna:

```bash
npm run build
```

## Struktura

- `src/App.tsx` - kompozycja aplikacji, stan, routing parametryzowany i wybór trybu słuchacza pod `?pakiet=ID`.
- `src/views/EdytorPaczkiView.tsx` - edytor paczki: metadane, edytowalne fiszki (dodaj / popraw / usuń), publikacja, eksport JSON, plakat QR.
- `src/views/GeneratorDialog.tsx` - dwustopniowy kreator: wybór/wgranie źródła z potwierdzeniem, potem edytowalna lista propozycji z zaznaczaniem i zapisem do paczki.
- `src/views/PlakatDialog.tsx` - generator profesjonalnego plakatu PNG z kodem QR (canvas), koduje adres `shareBaseUrl?pakiet=ID`.
- `src/views/TrybSluchacza.tsx` - aplikacja słuchacza (PWA): pobieranie paczki z zasobu, lokalna biblioteka paczek, nauka offline, instalacja, import z pliku.
- `src/views/InstrukcjaView.tsx` - wbudowana instrukcja obsługi ze zrzutami ekranu z `public/docs/`.
- `src/views/SluchaczeView.tsx` - „Podgląd nauki": postępy z IndexedDB tego urządzenia (do testowania paczek „oczami słuchacza"; postępy z telefonów nie docierają do panelu bez backendu).
- `src/views/UstawieniaView.tsx` - profil instruktora, adres zasobu NAS, tryb generatora, eksport kopii JSON i czyszczenie danych.
- `src/domain/packs.ts` - kontrakt paczki i fiszek, czyste operacje domenowe oraz odporny odczyt danych lokalnych.
- `src/domain/settings.ts` - ustawienia instruktora (profil, jednostka, adres zasobu, tryb generatora), powitanie i inicjały.
- `src/domain/sources.ts` - kontrakt źródła, deterministyczne dzielenie tekstu na cytaty i weryfikacja obecności cytatu w dokumencie.
- `src/domain/*.test.ts` - testy kontraktów domenowych (paczki, źródła, ustawienia) oraz regresyjny test jakości biblioteki `zrodla/` (każdy plik musi dać co najmniej 3 propozycje fiszek).
- `src/adapters/storage.ts` - IndexedDB: paczki, źródła, biblioteka paczek słuchacza, postępy, ustawienia, eksport kopii i czyszczenie danych.
- `src/adapters/ai.ts` - kontrakt lokalnego modelu (`POST /api/ai/generate`); backend nie jest podłączony, a odpowiedź jest i tak filtrowana przez `containsQuote`.
- `scripts/screenshots.mjs` - regeneracja zrzutów ekranu do instrukcji (headless Edge przez `puppeteer-core`); klika prawdziwy przepływ, w tym upload źródła z `scripts/fixtures/ustawa.txt`.
- `src/styles.css` - system wizualny i responsywność.
- `src/main.tsx` - punkt wejścia aplikacji.
- `zrodla/` - biblioteka materiałów źródłowych do generatora, pogrupowana wg jednostek modułowych JM01–JM10 programu szkolenia zawodowego podstawowego (Decyzja KGP nr 276/2023); szczegóły w `zrodla/README.md`.
- `vite.config.ts` - konfiguracja bundlera i lokalny endpoint `/api/ai/generate` (Ollama) w trybie dev.

## Kierunek skalowania

Następny krok powinien wydzielić moduły domenowe bez zmiany widoków:

- `domain/packs` - paczki, wersjonowanie, status publikacji,
- `domain/review` - workflow akceptacji,
- `domain/sources` - dokumenty i cytowania,
- `adapters/ai` - interfejs lokalnego modelu,
- `adapters/storage` - SQLite/IndexedDB,
- `features/learner` - PWA i tryb offline.

Przyszły adapter AI powinien implementować kontrakt w rodzaju `generateDraft(sourceContext, specification)`, a wynik musi zawierać cytat źródłowy, identyfikator dokumentu i poziom pewności. Brak potwierdzenia w źródle oznacza status `Do weryfikacji`, nigdy publikację.

Testy kontraktu domenowego:

```bash
npm test
```

Dane są lokalne i przechowywane w IndexedDB. Przed wdrożeniem szkolnym trzeba dodać role użytkowników, audyt zmian, podpisy paczek i import zatwierdzonych materiałów.

## Przepływ pracy

**Instruktor:** lista paczek → edytor paczki (klik na kartę) → „Generuj ze źródła" otwiera dialog: wybór pliku TXT/Markdown lub istniejącego źródła + potwierdzenie materiału → propozycje pokazują się od razu jako edytowalna lista z checkboxami — każdą można poprawić, usunąć lub odznaczyć przed zapisem. Fiszki można też dodawać ręcznie i edytować/usuwać w dowolnym momencie w edytorze. Nie ma osobnej kolejki propozycji.

**Dystrybucja:** edytor paczki → „Publikuj" → „Eksportuj paczkę" zapisuje `kompas-paczka-ID.json`, a „Plakat z QR" generuje plakat PNG z kodem prowadzącym pod `<adres zasobu>/?pakiet=ID` (adres konfigurowany w Ustawieniach → „Adres zasobu dla słuchaczy"). Na zasób NAS należy wrzucić zbudowaną aplikację (katalog `dist/`) oraz paczki JSON do podkatalogu `paczki/`.

**Słuchacz:** skan QR → otwiera aplikację, która automatycznie pobiera paczkę z `./paczki/kompas-paczka-ID.json` i zapisuje ją lokalnie → biblioteka „Moje paczki" zbiera wszystkie zeskanowane paczki → nauka działa w pełni offline, postęp zapisywany na urządzeniu. Aplikację można zainstalować jako PWA (`beforeinstallprompt`) albo wczytać paczkę ręcznie z pliku JSON.

Obecny generator ma bezpieczny tryb deterministyczny: tworzy propozycje wyłącznie z literalnych zdań źródłowych i wymaga potwierdzenia dokumentu. Tryb „Model lokalny" (Ustawienia → Generator) korzysta z adaptera `src/adapters/ai.ts`, ale backend `/api/ai/generate` nie jest jeszcze podłączony — po podłączeniu każda odpowiedź modelu zostanie i tak przesiana przez `containsQuote`, więc propozycja bez literalnego potwierdzenia w źródle nie trafi na listę.

Aplikacja obsługuje adresy bezpośrednie: `?view=paczki|sluchacze|ustawienia|instrukcja` wybiera widok panelu, `?paczka=ID` otwiera edytor paczki, `?pakiet=ID` uruchamia aplikację słuchacza. Wbudowana instrukcja obsługi (zakładka „Instrukcja") korzysta ze zrzutów w `public/docs/` — po zmianach UI można je odświeżyć poleceniem `node scripts/screenshots.mjs` przy działającym `npm run dev` (wymaga Microsoft Edge).


QR nie wskazuje na JSON — wskazuje na aplikację
Eksport paczki to tylko dane (JSON). Kod QR na plakacie koduje adres całej aplikacji: http://adres-zasobu/?pakiet=ID (adres ustawiasz w Ustawieniach → „Adres zasobu").

Czyli na NAS muszą leżeć dwie rzeczy obok siebie:

http://192.168.1.10/kompas/
├── index.html, assets/, manifest.webmanifest, sw.js, …   ← cały build aplikacji (folder dist/)
└── paczki/
    ├── kompas-paczka-9.json                              ← wyeksportowane paczki
    └── kompas-paczka-10.json
Telefon po zeskanowaniu QR pobiera z NAS aplikację (HTML+JS), a aplikacja sama doczytuje paczkę z paczki/. Większość NAS-ów (Synology, QNAP) ma wbudowany serwer WWW — wystarczy wrzucić dist do udostępnionego katalogu webowego.

Ważne zastrzeżenie: PWA wymaga HTTPS
Tu jest haczyk, którego nie mogę pominąć: service worker i instalacja PWA działają tylko w „bezpiecznym kontekście" — czyli HTTPS albo localhost




https://<adres-nas>/              ← web root witryny
├── index.html                    ← aplikacja (panel + tryb słuchacza)
├── manifest.webmanifest          ← instalacja PWA
├── sw.js                         ← service worker (offline) — musi być w root
├── icon.svg
├── assets/
│   ├── index-*.js
│   └── index-*.css
├── docs/                         ← screenshocki do widoku Instrukcja (opcjonalne)
└── paczki/
    ├── kompas-paczka-9.json      ← eksportowane paczki (Eksportuj JSON → wrzucasz tu)
    └── kompas-paczka-10.json