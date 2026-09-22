# Źródła szkoleniowe — Kompas Wiedzy

Biblioteka materiałów źródłowych do generatora fiszek, zorganizowana według
jednostek modułowych (JM) **programu szkolenia zawodowego podstawowego
policjantów**.

## Podstawa programowa

- **Decyzja Nr 276 Komendanta Głównego Policji z 25.08.2023 r.** — program
  szkolenia zawodowego podstawowego dla policjantów (JM01–JM10).
  <https://edziennik.policja.gov.pl/DU_KGP/2023/81/oryginal/akt.pdf>
- **Decyzja Nr 109 KGP z 4.04.2024 r.** — program dla absolwentów wybranych
  kierunków studiów (wersja skrócona, alternatywna).
  <https://edziennik.policja.gov.pl/DU_KGP/2024/29/oryginal/akt.pdf>

## Struktura

| Folder | Jednostka modułowa | Pliki |
|---|---|---|
| `jm01-miejsce-zdarzenia` | JM01 Ustalenie okoliczności zdarzeń i zabezpieczenie miejsca | miejsce-zdarzenia-i-ogledziny.txt, pierwsza-pomoc-przedmedyczna.txt (ERC 2025), paczka-pierwsza-pomoc.json (gotowa paczka 30 fiszek), przesluchanie-przepisy.txt |
| `jm02-interwencje` | JM02 Bezpieczeństwo, porządek publiczny, interwencje | legitymowanie.txt, zatrzymanie-i-kontrola-osobista.txt, etyka-zawodowa.txt, legitymowanie-przepisy.txt, zatrzymanie-podejrzanego-przepisy.txt |
| `jm03-poszukiwania` | JM03 Poszukiwanie osób i rzeczy, czynności operacyjno-rozpoznawcze | czynnosci-operacyjne.txt |
| `jm04-konwoje-poz` | JM04 Służba w konwojach i pomieszczeniach dla zatrzymanych | osoba-zatrzymana-i-poz.txt |
| `jm05-ruch-drogowy` | JM05 Działania wobec uczestników ruchu drogowego | prawo-o-ruchu-drogowym.txt, kontrola-trzezwosci-i-izba-wytrzezwien.txt, poscig-za-pojazdem-przepisy.txt |
| `jm06-wykroczenia` | JM06 Czynności w sprawach o wykroczenia | postepowanie-w-sprawach-o-wykroczenia.txt |
| `jm07-porzadek-publiczny` | JM07 Przywracanie zbiorowo naruszonego porządku | zabezpieczenie-zgromadzen.txt |
| `jm08-kryminogenne` | JM08 Przeciwdziałanie zjawiskom kryminogennym | przemoc-domowa-i-nieletni.txt |
| `jm09-strzeleckie` | JM09 Szkolenie strzeleckie | zasady-bezpieczenstwa-na-strzelnicy.txt |
| `jm10-tti` | JM10 Taktyka i techniki interwencji | srodki-przymusu-bezposredniego.txt, srodki-przymusu-przepisy.txt |
| `cyberhigiena` | Materiał uzupełniający — cyberhigiena użytkownika | cyberhigiena-uzytkownika.txt, paczka-cyberhigiena.json (gotowa paczka 30 fiszek — Paczki → „Importuj paczkę") |

## Status treści — WAŻNE

Pliki `.txt` są **opracowaniami szkoleniowymi przygotowanymi dla aplikacji**,
a nie oficjalnym tekstem aktów prawnych. Treść parafrazuje przepisy i procedury
językiem zoptymalizowanym pod generator fiszek (pełne zdania, jeden fakt na
zdanie). Instruktor zatwierdzając źródło potwierdza, że jest ono właściwe dla
celów szkoleniowych — jak w każdym materiale dydaktycznym.

Akty prawne, na których oparte są opracowania (stanowią podstawę weryfikacji):

- Ustawa z 6.04.1990 r. **o Policji** (art. 14, 15 — legitymowanie, zatrzymanie,
  kontrola osobista; rozdz. 4a — czynności operacyjno-rozpoznawcze)
- Ustawa z 24.05.2013 r. **o środkach przymusu bezpośredniego i broni palnej**
- **Kodeks postępowania karnego** (art. 244 — zatrzymanie; art. 207 — oględziny)
- **Kodeks postępowania w sprawach o wykroczenia** (24.08.2001) — mandat karny
- **Kodeks wykroczeń**
- Ustawa z 20.06.1997 r. **Prawo o ruchu drogowym**
- Ustawa z 26.10.1982 r. **o wychowaniu w trzeźwości i przeciwdziałaniu
  alkoholizmowi** — izba wytrzeźwień
- Ustawa z 29.07.2005 r. **o przeciwdziałaniu przemocy domowej** — Niebieska Karta
- Ustawa z 26.10.1982 r. **o postępowaniu w sprawach nieletnich**
- Ustawa z 20.03.2009 r. **o bezpieczeństwie imprez masowych**
- Ustawa z 15.07.2011 r. **o zgromadzeniach**
- Rozporządzenie MSWiA z 15.11.2007 r. **w sprawie sposobu podejmowania
  i prowadzenia pościgu za pojazdem mechanicznym**

Pliki `*-przepisy.txt` to **ekstrakty dosłowne**: wybrane przepisy w formacie
„Art. X § Y stanowi, że…" — zdanie samo-cytuje akt, więc odpowiedź fiszki
niesie numer przepisu. Przeznaczone na materiał „must-know"; numery
artykułów przed publikacją zweryfikuj w tekście jednolitym.

Aktualny tekst jednolity każdego aktu należy weryfikować w **ELI / Dzienniku
Ustaw** (eli.gov.pl) — numery tekstów jednolitych zmieniają się wraz
z nowelizacjami. Przed zatwierdzeniem źródła do produkcyjnej paczki instruktor
powinien zweryfikować, czy cytowane przepisy nie uległy zmianie.

## Zasady optymalizacji pod generator

Pliki są pisane tak, aby dobrze współpracowały z `src/domain/sources.ts`
(`draftsFromSource`, `questionFor`) oraz z modelem LLM:

- jedno zdanie = jeden fakt, minimum ~45 znaków,
- jawny podmiot i orzeczenie („Policjant jest obowiązany…", „Osoba ma prawo…",
  „Może nastąpić wyłącznie…", „Zabrania się…"),
- konstrukcje przyjazne wzorcom pytań: warunek („jeżeli", „w przypadku"),
  skutek („może skutkować"), cel („w celu"), zakaz, obowiązek, uprawnienie,
- bez tabel, nagłówków stron, urwanych fragmentów i zaimek bez kontekstu,
- jedno źródło może dać do ~40 fiszek (limit zdań na plik: 400; limit fiszek
  ustawiany w Ustawieniach → Generator: 8/16/24/32/40).

## Podstawa prawna per sekcja (wieloaktowe źródła)

Fiszki dziedziczą podstawę prawną z **najbliższego poprzedzającego zdania-podstawy**
(`legalBasisForSentence`). Zdanie-podstawa poznajemy po formule „…określa /
reguluje / stanowi podstawę…" + nazwa aktu (ustawa/Kodeks/rozporządzenie/
regulamin/wytyczne/Konstytucja/art.).

Zasady pisania źródła wieloaktowego (wzorzec: `jm08/przemoc-domowa-i-nieletni.txt`,
`jm09/zasady-bezpieczenstwa-na-strzelnicy.txt`):

1. **Podstawa zawsze PRZED sekcją**, której dotyczy — nigdy po.
   ```
   [podstawa aktu A]
   [zdanie-fakt 1] [zdanie-fakt 2] …   → fiszki dostają podstawę A
   [podstawa aktu B]
   [zdanie-fakt 10] [zdanie-fakt 11] … → fiszki dostają podstawę B
   ```
2. Pierwsza linia-podstawa w pliku staje się też podstawą „domyślną"
   (`detectLegalBasis`) — najlepiej dać na początku podstawę ogólną dokumentu.
3. Zdanie-fakt, które **samo cytuje nazwę aktu** (np. „Znęcanie się nad osobą
   najbliższą stanowi przestępstwo na podstawie Kodeksu karnego."), dostaje
   `(brak)` — odpowiedź niesie cytat, chip by go duplikował. To działa celowo;
   nie trzeba takiego zdania poprzedzać linią-podstawą.
4. Unikaj słowa „podstaw…" w zdaniach-faktach („odpowiednie podstawy prawne") —
   pisz np. „odpowiednie uprawnienia", bo zdanie może zostać uznane za linię-podstawę.
5. Każde zdanie-podstawa zawiera **datę i tytuł aktu** — treść chipa to pełne
   zdanie źródła, widoczne słuchaczowi na odwrocie fiszki.
6. Fiszka z samego zdania-podstawy też jest sensowna (pytanie „Jaki akt reguluje…?"),
   ale wtedy może zostać odznaczona w propozycjach — jest to karta-sprawdzian.

## Dodawanie nowego źródła

1. Wybierz folder odpowiadający jednostce modułowej (lub utwórz nowy wg schematu
   `jmNN-temat`).
2. Napisz plik `.txt` w UTF-8 wg zasad powyżej: podstawa ogólna na początku,
   a przed każdą sekcją objętą innym aktem — własna linia-podstawa.
3. Dopisz wiersz do tabeli powyżej i odnotuj akt do wykazu.
4. Zaimportuj w aplikacji (Generator → „Importuj plik"), zatwierdź i wygeneruj
   propozycje — zweryfikuj, czy odpowiedzi są sensownymi cytatami.
