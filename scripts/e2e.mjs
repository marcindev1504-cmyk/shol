import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const DL = path.resolve('downloads-e2e')
fs.rmSync(DL, { recursive: true, force: true })
fs.mkdirSync(DL, { recursive: true })

let failures = 0
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--no-default-browser-check'] })

async function clickButton(page, text) {
  return page.evaluate((label) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes(label) && !item.disabled)
    if (!button) return false
    button.click()
    return true
  }, text)
}

async function waitFile(prefix, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const found = fs.readdirSync(DL).find((f) => f.startsWith(prefix) && !f.endsWith('.crdownload'))
    if (found) return path.join(DL, found)
  }
  return null
}

async function typeInto(selector, text, page, { clear = false } = {}) {
  await page.click(selector)
  if (clear) { await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace') }
  await page.type(selector, text)
}

async function appendTo(page, selector, text) {
  await page.evaluate((sel, txt) => {
    const el = document.querySelector(sel)
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, el.value + txt)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, selector, text)
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  page.on('dialog', (d) => void d.accept())
  const cdp = await page.createCDPSession()
  try {
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
  } catch {
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
  }

  // ── 1. Start: seed data ─────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.pack-card', { timeout: 15000 })
  check('start: 3 paczki seedów', (await page.$$('.pack-card')).length === 3)

  // ── 2. Wyszukiwarka ─────────────────────────────────────────────────
  await page.type('.search-box input', 'legitymowanie')
  check('wyszukiwarka filtruje', (await page.$$('.pack-card')).length === 1)
  await page.click('.search-box input')
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await sleep(400)
  const q = await page.$eval('.search-box input', (el) => el.value)
  check('wyszukiwarka czyści', (await page.$$('.pack-card')).length === 3, `query="${q}", kart=${(await page.$$('.pack-card')).length}`)

  // ── 3. Widok lista/siatka ───────────────────────────────────────────
  await page.click('.view-toggle button:last-child')
  check('przełącznik widoku na listę', await page.$eval('.pack-grid', (el) => el.classList.contains('list')))
  await page.click('.view-toggle button:first-child')

  // ── 4. Nowa paczka: dialog tworzenia + blokada publikacji pustej ────
  await sleep(500)
  await clickButton(page, 'Nowa paczka')
  await page.waitForSelector('.create-pack-submit')
  check('dialog: utwórz zablokowany bez nazwy', await page.$eval('.create-pack-submit', (el) => el.disabled))
  await page.type('.modal label input', 'Paczka E2E')
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.modal label input')]
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[1], 'Testy automatyczne')
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickButton(page, 'Utwórz paczkę')
  await page.waitForSelector('.pack-editor')
  check('nowa paczka otwiera edytor', await page.$eval('.editor-title-input', (el) => el.value === 'Paczka E2E'))
  check('URL ma ?paczka=', (await page.url()).includes('paczka='))
  check('temat z dialogu w edytorze', await page.$eval('.editor-subject-input', (el) => el.value === 'Testy automatyczne'))
  check('publikacja pustej paczki zablokowana', await page.$eval('.editor-publish .primary-button', (el) => el.disabled))

  // ── 6. Ręczne dodanie fiszki ────────────────────────────────────────
  await clickButton(page, 'Dodaj fiszkę')
  await page.waitForSelector('.card-editor.editing')
  check('zapis pustej fiszki zablokowany', await page.$eval('.card-editor.editing .primary-button', (el) => el.disabled))
  await page.type('.card-editor.editing textarea', 'Pytanie testowe numer jeden?')
  await page.type('.card-editor.editing label:nth-of-type(2) textarea', 'Odpowiedź testowa numer jeden.')
  await clickButton(page, 'Zapisz fiszkę')
  await sleep(300)
  check('fiszka dodana do listy', await page.$eval('.editor-meta', (el) => el.textContent.includes('1 fiszek')))

  // druga fiszka
  await clickButton(page, 'Dodaj fiszkę')
  await page.waitForSelector('.card-editor.editing')
  await page.type('.card-editor.editing textarea', 'Pytanie testowe numer dwa?')
  await page.type('.card-editor.editing label:nth-of-type(2) textarea', 'Odpowiedź testowa numer dwa.')
  await clickButton(page, 'Zapisz fiszkę')
  await sleep(300)
  check('dwie fiszki w paczce', (await page.$$('.card-editor:not(.editing)')).length === 2)

  // ── 7. Edycja istniejącej fiszki ────────────────────────────────────
  await page.click('.card-editor .outline-button')
  await page.waitForSelector('.card-editor.editing')
  await appendTo(page, '.card-editor.editing textarea', ' [POPRAWIONE]')
  await clickButton(page, 'Zapisz fiszkę')
  await sleep(300)
  check('edycja fiszki zapisana', await page.$eval('.card-editor strong', (el) => el.textContent.includes('[POPRAWIONE]')))

  // ── 8. Usunięcie fiszki ─────────────────────────────────────────────
  const before = (await page.$$('.card-editor:not(.editing)')).length
  await page.$$eval('.card-editor:not(.editing) .icon-button', (els) => els[els.length - 1].click())
  await sleep(300)
  check('usunięcie fiszki', (await page.$$('.card-editor:not(.editing)')).length === before - 1)

  // ── 9. Publikacja ───────────────────────────────────────────────────
  await clickButton(page, 'Opublikuj')
  await sleep(300)
  check('paczka opublikowana', await page.$eval('.editor-publish .status', (el) => el.textContent.includes('Opublikowana')))
  check('przycisk publikacji nieaktywny po publikacji', await page.$eval('.editor-publish .primary-button', (el) => el.disabled))

  // ── 10. Persistencja po przeładowaniu ───────────────────────────────
  const packUrl = await page.url()
  await page.goto(packUrl, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.pack-editor')
  check('dane przetrwały reload (IndexedDB)', await page.$eval('.editor-meta', (el) => el.textContent.includes('1 fiszek')))

  // ── 11. Generator: walidacja ────────────────────────────────────────
  await clickButton(page, 'Generuj ze źródła')
  await page.waitForSelector('.generator-modal')
  check('generuj zablokowane bez źródła', await page.$eval('.generator-modal .primary-button.full', (el) => el.disabled))

  const fileInput = await page.$('.generator-modal .file-button input')
  await fileInput.uploadFile('scripts/fixtures/bad.png')
  await page.waitForSelector('.generator-modal .form-error')
  check('odrzucenie pliku PNG', await page.$eval('.generator-modal .form-error', (el) => el.textContent.includes('TXT')))

  await fileInput.uploadFile('scripts/fixtures/short.txt')
  await page.waitForSelector('.generator-modal .form-error')
  check('odrzucenie za krótkiego dokumentu', await page.$eval('.generator-modal .form-error', (el) => el.textContent.includes('krótki')))

  // ── 12. Generator: pełny przepływ ───────────────────────────────────
  await fileInput.uploadFile('scripts/fixtures/ustawa.txt')
  await page.waitForSelector('.generator-modal .source-select')
  await page.click('.generator-modal .source-select')
  await page.waitForSelector('.confirm-source input')
  check('źródło wymaga potwierdzenia', await page.$eval('.generator-modal .primary-button.full', (el) => el.disabled))
  await page.click('.confirm-source input')
  check('potwierdzenie odblokowuje generowanie', !(await page.$eval('.generator-modal .primary-button.full', (el) => el.disabled)))
  await clickButton(page, 'Generuj propozycje')
  await page.waitForSelector('.proposal')
  const proposalCount = (await page.$$('.proposal')).length
  check('propozycje wygenerowane', proposalCount >= 3, `${proposalCount} szt.`)

  // edycja propozycji
  await appendTo(page, '.proposal textarea', ' [EDYTOWANE]')
  check('propozycja edytowalna', await page.$eval('.proposal textarea', (el) => el.value.includes('[EDYTOWANE]')))

  // odznaczenie + usunięcie
  await page.$$eval('.proposal input[type="checkbox"]', (els) => els[1].click())
  await page.$$eval('.proposal .icon-button', (els) => els[2].click())
  await sleep(200)
  const remaining = (await page.$$('.proposal')).length
  check('usunięcie propozycji', remaining === proposalCount - 1)
  const checkedCount = await page.$$eval('.proposal input[type="checkbox"]', (els) => els.filter((el) => el.checked).length)
  check('licznik zaznaczonych', await page.$eval('.generator-footer .primary-button', (el, n) => el.textContent.includes(`(${n})`), checkedCount))

  await clickButton(page, 'Dodaj zaznaczone')
  await sleep(400)
  check('dialog zamknięty po zapisie', (await page.$('.generator-modal')) === null)
  check('fiszki dopisane do paczki', await page.$eval('.editor-meta', (el, n) => el.textContent.includes(`${n} fiszek`), 1 + checkedCount), `oczekiwano ${1 + checkedCount}`)
  check('edytowana propozycja w paczce', await page.$eval('.card-editor-list', (el) => el.textContent.includes('[EDYTOWANE]')))

  // ── 13. Źródło zapamiętane jako zatwierdzone ────────────────────────
  await clickButton(page, 'Generuj ze źródła')
  await page.waitForSelector('.generator-modal .source-select')
  check('źródło widnieje jako zatwierdzone', await page.$eval('.generator-modal .source-select', (el) => el.textContent.includes('zatwierdzone')))
  await page.click('.generator-modal .source-select')
  check('zatwierdzone źródło nie wymaga checkboxa', (await page.$('.confirm-source')) === null)
  check('generuj odblokowane dla zatwierdzonego', !(await page.$eval('.generator-modal .primary-button.full', (el) => el.disabled)))
  await page.click('.generator-modal .modal-close')

  // ── 14. Eksport paczki JSON ─────────────────────────────────────────
  await clickButton(page, 'Eksportuj paczkę')
  const packFile = await waitFile('kompas-paczka-')
  check('pobranie JSON paczki', !!packFile)
  if (packFile) {
    const exported = JSON.parse(fs.readFileSync(packFile, 'utf8'))
    check('JSON zawiera fiszki', Array.isArray(exported.flashcards) && exported.flashcards.length === 1 + checkedCount)
    check('JSON zawiera tytuł', exported.title === 'Paczka E2E')
    check('JSON zawiera status publikacji', exported.status === 'Zatwierdzone')
  }

  // ── 15. Plakat QR ───────────────────────────────────────────────────
  await clickButton(page, 'Plakat z QR')
  await page.waitForSelector('.poster-canvas')
  await page.waitForFunction(() => !document.querySelector('.poster-modal .primary-button')?.disabled, { timeout: 10000 })
  check('plakat wyrenderowany na canvas', await page.evaluate(() => {
    const c = document.querySelector('.poster-canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    for (let i = 0; i < d.length; i += 997 * 4) { if (d[i] > 40 || d[i + 1] > 40) return true }
    return false
  }))
  check('plakat pokazuje URL paczki', await page.$eval('.poster-url', (el) => el.textContent.includes('?pakiet=')))
  await clickButton(page, 'Pobierz plakat')
  const posterFile = await waitFile('kompas-plakat-')
  check('pobranie plakatu PNG', !!posterFile && fs.statSync(posterFile).size > 20000, posterFile ? `${Math.round(fs.statSync(posterFile).size / 1024)} KB` : 'brak pliku')
  await page.click('.poster-modal .modal-close')

  // ── 16. Ustawienia: adres NAS wpływa na QR ──────────────────────────
  await page.goto(`${BASE}/?view=ustawienia`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.settings-grid')
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('.settings-card label')].find((l) => l.textContent.includes('Adres bazowy'))
    const input = label.querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'http://192.168.1.10/kompas')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickButton(page, 'Zapisz ustawienia')
  await sleep(300)
  check('ustawienia zapisane', await page.$eval('.notice', (el) => el.textContent.includes('Ustawienia zapisane')))

  await page.goto(`${BASE}/?paczka=2`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.pack-editor')
  await clickButton(page, 'Plakat z QR')
  await page.waitForSelector('.poster-url')
  check('QR używa adresu NAS', await page.$eval('.poster-url', (el) => el.textContent.includes('http://192.168.1.10/kompas/?pakiet=2')))
  await page.click('.poster-modal .modal-close')

  // ── 17. Menu ••• na karcie paczki ───────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.pack-card')
  await page.click('.pack-card .more-button')
  await page.waitForSelector('.pack-menu')
  check('menu ••• otwiera się', true)
  await clickButton(page, 'Eksportuj JSON')
  check('eksport z menu •••', !!(await waitFile('kompas-paczka-')))

  // ── 18. Usunięcie paczki przez menu ••• ─────────────────────────────
  const packsBefore = (await page.$$('.pack-card')).length
  await page.click('.pack-card .more-button')
  await page.waitForSelector('.pack-menu')
  await clickButton(page, 'Usuń paczkę')
  await sleep(500)
  check('usunięcie paczki (z potwierdzeniem)', (await page.$$('.pack-card')).length === packsBefore - 1)

  // ── 19. Tryb słuchacza: pobranie z „NAS" ────────────────────────────
  const learner = await browser.newPage()
  await learner.setViewport({ width: 480, height: 900 })
  learner.on('dialog', (d) => void d.accept())
  await learner.goto(`${BASE}/?pakiet=9`, { waitUntil: 'networkidle0' })
  await learner.waitForSelector('.flashcard', { timeout: 15000 })
  check('słuchacz: paczka pobrana z paczki/*.json', await learner.$eval('h1', (el) => el.textContent.includes('zasobu sieciowego')))

  await clickButton(learner, 'Pokaż odpowiedź')
  await learner.waitForSelector('.flashcard.revealed')
  check('słuchacz: odkrycie odpowiedzi + źródło', await learner.$eval('.flashcard-face.back small', (el) => el.textContent.length > 0))
  check('słuchacz: brak chipa podstawy w paczce 9', (await learner.$('.legal-basis-chip')) === null)
  await clickButton(learner, 'Pamiętam')
  await sleep(300)
  check('słuchacz: przejście do fiszki 2', await learner.$eval('.learner-progress span', (el) => el.textContent.includes('2 z 2')))
  await clickButton(learner, 'Nie pamiętam')
  await learner.waitForSelector('.summary-card')
  check('słuchacz: podsumowanie sesji', await learner.$eval('.summary-detail', (el) => el.textContent.includes('Znasz 1 z 2')))

  // drugi skan QR dopisuje paczkę (paczka 2 jest w bazie instruktora tego profilu)
  await learner.goto(`${BASE}/?pakiet=2`, { waitUntil: 'networkidle0' })
  await learner.waitForSelector('.flashcard')
  check('słuchacz: kolejny QR otwiera inną paczkę', await learner.$eval('h1', (el) => el.textContent.includes('przymusu')))
  await clickButton(learner, 'Pamiętam')
  await sleep(300)

  // ── 20. Biblioteka słuchacza ────────────────────────────────────────
  await clickButton(learner, 'Moje paczki')
  await learner.waitForSelector('.learner-pack-list')
  check('biblioteka: dwie paczki po dwóch skanach', (await learner.$$('.learner-pack')).length === 2)
  check('biblioteka: pobrana paczka z postępem', await learner.$eval('.learner-pack-list', (el) => el.textContent.includes('postęp 2/2')))

  const importInput = await learner.$('input[type="file"]')
  await importInput.uploadFile('scripts/fixtures/paczka-import.json')
  await sleep(600)
  check('biblioteka: import z pliku JSON', (await learner.$$('.learner-pack')).length === 3)
  check('biblioteka: importowana paczka widoczna', await learner.$eval('.learner-pack-list', (el) => el.textContent.includes('Paczka importowana E2E')))

  // usunięcie z biblioteki
  await learner.$$eval('.learner-pack .icon-button', (els) => els[els.length - 1].click())
  await sleep(500)
  check('biblioteka: usunięcie paczki', (await learner.$$('.learner-pack')).length === 2)

  // persistencja biblioteki
  await learner.goto(`${BASE}/?pakiet=`, { waitUntil: 'networkidle0' })
  await learner.waitForSelector('.learner-pack-list')
  check('biblioteka: paczki przetrwały reload', (await learner.$$('.learner-pack')).length === 2)

  // ── 21. Nieznana paczka → błąd ──────────────────────────────────────
  await learner.goto(`${BASE}/?pakiet=999`, { waitUntil: 'networkidle0' })
  await learner.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Nie udało'), { timeout: 15000 })
  check('słuchacz: błąd dla nieznanej paczki + link do biblioteki', (await learner.$('.learner-primary')) !== null)

  // ── 22. Widok Słuchacze w panelu ────────────────────────────────────
  await page.goto(`${BASE}/?view=sluchacze`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.library-list')
  check('panel słuchacze: postęp nauki widoczny', await page.$eval('.library-list', (el) => el.textContent.includes('Środki przymusu') && el.textContent.includes('Postęp: fiszka')))

  // ── 23. Instrukcja renderuje się ze zrzutami ────────────────────────
  await page.goto(`${BASE}/?view=instrukcja`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.manual-toc')
  const brokenImgs = await page.$$eval('.manual-body img, .instrukcja img, img', (els) => els.filter((img) => img.complete && img.naturalWidth === 0).length)
  check('instrukcja: wszystkie zrzuty się ładują', brokenImgs === 0, `${brokenImgs} uszkodzonych`)

  // ── 24. AI: tryb modelu lokalnego ───────────────────────────────────
  const aiPage = await browser.newPage()
  await aiPage.setViewport({ width: 1440, height: 960 })
  await aiPage.setRequestInterception(true)
  let aiScenario = 'mixed'
  let aiRequestBody = null
  const VERBATIM = 'Policjant podaje osobie legitymowanej swój stopień, imię i nazwisko oraz przyczynę podjęcia czynności.'
  aiPage.on('request', (req) => {
    if (!req.url().includes('/api/ai/generate')) { void req.continue(); return }
    aiRequestBody = req.postData()
    if (aiScenario === 'off') { void req.abort(); return }
    const scenarios = {
      mixed: { status: 200, body: { cards: [
        { question: 'Co policjant podaje osobie legitymowanej?', answer: VERBATIM, source: 'ustawa.txt' },
        { question: 'Halucynacja modelu?', answer: 'Całkowicie zmyślona odpowiedź, której nie ma w dokumencie źródłowym.' },
      ]}},
      hallucinated: { status: 200, body: { cards: [{ question: 'Fake?', answer: 'Zmyślona treść bez potwierdzenia w źródle dokumentu.' }] } },
      error503: { status: 503, body: { error: 'Model jest przeciążony.' } },
      badshape: { status: 200, body: { foo: 1 } },
    }
    const r = scenarios[aiScenario]
    if (r) void req.respond({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) })
    else void req.continue()
  })

  await aiPage.goto(`${BASE}/?view=ustawienia`, { waitUntil: 'networkidle0' })
  await aiPage.waitForSelector('.settings-grid')
  await aiPage.select('.settings-card select', 'model')
  await clickButton(aiPage, 'Zapisz ustawienia')
  await sleep(300)

  await aiPage.goto(`${BASE}/?paczka=2`, { waitUntil: 'networkidle0' })
  await aiPage.waitForSelector('.pack-editor')
  await clickButton(aiPage, 'Generuj ze źródła')
  await aiPage.waitForSelector('.generator-modal')
  check('AI: dialog pokazuje tryb modelu lokalnego', await aiPage.$eval('.generator-modal .modal-copy', (el) => el.textContent.includes('model lokalny')))

  const aiFileInput = await aiPage.$('.generator-modal .file-button input')
  await aiFileInput.uploadFile('scripts/fixtures/ustawa.txt')
  await aiPage.waitForSelector('.generator-modal .source-select')
  await sleep(400)
  await aiPage.$$eval('.source-select', (els) => els[els.length - 1].click())
  await sleep(300)
  const confirmBox = await aiPage.$('.confirm-source input')
  if (confirmBox) { await confirmBox.click(); await sleep(200) }
  await clickButton(aiPage, 'Generuj propozycje')
  await aiPage.waitForSelector('.proposal')
  check('AI: zapytanie zawiera treść źródła', typeof aiRequestBody === 'string' && aiRequestBody.includes('Policjant podaje'))
  check('AI: halucynacja odrzucona przez containsQuote', (await aiPage.$$('.proposal')).length === 1)
  check('AI: komunikat o automatycznym odrzuceniu', await aiPage.$eval('.generator-modal .modal-copy', (el) => el.textContent.includes('Odrzucono automatycznie 1')))
  check('AI: zweryfikowana propozycja ma cytat', await aiPage.$eval('.proposal textarea:nth-of-type(2)', (el, v) => el.value === v, VERBATIM))

  await clickButton(aiPage, 'Dodaj zaznaczone')
  await sleep(400)
  check('AI: fiszka z modelu w paczce', await aiPage.$eval('.card-editor-list', (el) => el.textContent.includes('Co policjant podaje osobie legitymowanej?')))

  // samo halucynacje → czytelny błąd
  await clickButton(aiPage, 'Generuj ze źródła')
  await aiPage.waitForSelector('.generator-modal .source-select')
  await aiPage.$$eval('.source-select', (els) => els[els.length - 1].click())
  aiScenario = 'hallucinated'
  await clickButton(aiPage, 'Generuj propozycje')
  await aiPage.waitForSelector('.generator-modal .form-error')
  check('AI: wszystkie halucynacje → błąd', await aiPage.$eval('.generator-modal .form-error', (el) => el.textContent.includes('potwierdzonej cytatem')))

  // błąd HTTP z komunikatem backendu
  aiScenario = 'error503'
  await clickButton(aiPage, 'Generuj propozycje')
  await aiPage.waitForSelector('.generator-modal .form-error')
  check('AI: komunikat błędu z backendu', await aiPage.$eval('.generator-modal .form-error', (el) => el.textContent.includes('przeciążony')))

  // nieprawidłowy format odpowiedzi
  aiScenario = 'badshape'
  await clickButton(aiPage, 'Generuj propozycje')
  await aiPage.waitForSelector('.generator-modal .form-error')
  check('AI: nieprawidłowy format odpowiedzi', await aiPage.$eval('.generator-modal .form-error', (el) => el.textContent.includes('nieprawidłowy format')))

  // backend offline → przyjazny komunikat
  aiScenario = 'off'
  await clickButton(aiPage, 'Generuj propozycje')
  await aiPage.waitForSelector('.generator-modal .form-error')
  check('AI: brak backendu → przyjazny komunikat', await aiPage.$eval('.generator-modal .form-error', (el) => el.textContent.includes('niedostępny')))
  await aiPage.close()

  // ── 25. Reset danych (na końcu — czyści wszystko) ───────────────────
  await page.goto(`${BASE}/?view=ustawienia`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.settings-grid')
  await clickButton(page, 'Wyczyść wszystkie dane')
  await page.waitForSelector('.pack-card', { timeout: 15000 })
  check('reset: powrót do 3 seedów', (await page.$$('.pack-card')).length === 3)

  // ── 25. Podstawa prawna: propozycje → edytor → eksport → QR → PWA ──
  console.log('…podstawa: start sekcji')
  await page.goto(`${BASE}/?paczka=1`, { waitUntil: 'networkidle0' })
  console.log('…podstawa: goto ok')
  await page.waitForSelector('.pack-editor')
  console.log('…podstawa: editor ok')
  const packTitle = await page.$eval('.editor-title-input', (el) => el.value)
  console.log('…podstawa: title ok')

  await clickButton(page, 'Generuj ze źródła')
  console.log('…podstawa: dialog')
  await page.waitForSelector('.generator-modal')
  console.log('…podstawa: modal')
  const dwaAktyInput = await page.$('.generator-modal .file-button input')
  console.log('…podstawa: input')
  await dwaAktyInput.uploadFile('scripts/fixtures/dwa-akty.txt')
  console.log('…podstawa: uploaded')
  await page.waitForSelector('.generator-modal .source-select')
  console.log('…podstawa: source listed')
  await page.$$eval('.source-select', (els) => els[els.length - 1].click())
  console.log('…podstawa: source clicked')
  await page.waitForSelector('.confirm-source input')
  console.log('…podstawa: confirm shown')
  check('podstawa: nota o wykrytej podstawie w dialogu', await page.$eval('.legal-basis-note', (el) => el.textContent.includes('przeciwdziałaniu przemocy domowej')))
  await page.$eval('.confirm-source input', (el) => el.click())
  await clickButton(page, 'Generuj propozycje')
  await page.waitForSelector('.proposal')

  const basisValues = await page.$$eval('.proposal input[placeholder*="Podstawa"]', (els) => els.map((el) => el.value))
  check('podstawa: sekcja A → ustawa o przemocy domowej', basisValues.filter((v) => v.includes('przeciwdziałaniu przemocy domowej')).length >= 3, JSON.stringify(basisValues))
  check('podstawa: sekcja B → ustawa o nieletnich', basisValues.filter((v) => v.includes('sprawach nieletnich')).length >= 2)
  check('podstawa: zdania samo-cytujące bez chipa', basisValues.some((v) => v === ''))

  // edycja podstawy w propozycji → trafia na kartę
  await page.evaluate(() => {
    const input = document.querySelector('.proposal input[placeholder*="Podstawa"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'KONTEKST-E2E')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(150)
  await clickButton(page, 'Dodaj zaznaczone')
  await sleep(400)
  check('podstawa: edytowana propozycja → chip w edytorze', await page.$eval('.card-editor-list', (el) => el.textContent.includes('KONTEKST-E2E')))

  // edycja podstawy w edytorze paczki (karta z chipem)
  const chipCardIndex = await page.$$eval('.card-editor:not(.editing)', (cards) => cards.findIndex((c) => c.querySelector('.legal-basis-chip')))
  await page.$$eval('.card-editor:not(.editing) .outline-button', (els, i) => els[i].click(), chipCardIndex)
  await page.waitForSelector('.card-editor.editing')
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('.card-editor.editing label')].find((l) => l.textContent.includes('Podstawa prawna'))
    const input = label.querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'EDYCJA-E2E')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickButton(page, 'Zapisz fiszkę')
  await sleep(300)
  check('podstawa: edycja w edytorze zapisana', await page.$eval('.card-editor-list', (el) => el.textContent.includes('EDYCJA-E2E')))

  // wyczyszczenie podstawy → chip znika
  const chipsBefore = (await page.$$('.card-editor:not(.editing) .legal-basis-chip')).length
  const otherChipIndex = await page.$$eval('.card-editor:not(.editing)', (cards) => cards.findIndex((c) => c.querySelector('.legal-basis-chip') && !c.textContent.includes('EDYCJA-E2E')))
  await page.$$eval('.card-editor:not(.editing) .outline-button', (els, i) => els[i].click(), otherChipIndex)
  await page.waitForSelector('.card-editor.editing')
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('.card-editor.editing label')].find((l) => l.textContent.includes('Podstawa prawna'))
    const input = label.querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickButton(page, 'Zapisz fiszkę')
  await sleep(300)
  check('podstawa: wyczyszczenie usuwa chip', (await page.$$('.card-editor:not(.editing) .legal-basis-chip')).length === chipsBefore - 1)

  // eksport JSON → legalBasis w paczce (czyścimy starsze eksporty o tej samej nazwie)
  for (const f of fs.readdirSync(DL).filter((x) => x.startsWith('kompas-paczka-'))) fs.rmSync(path.join(DL, f))
  await clickButton(page, 'Eksportuj paczkę')
  const basisPackFile = await waitFile('kompas-paczka-')
  check('podstawa: eksport paczki z basisami', !!basisPackFile)
  if (basisPackFile) {
    const exp = JSON.parse(fs.readFileSync(basisPackFile, 'utf8'))
    check('podstawa: eksport zawiera EDYCJA-E2E', exp.flashcards.some((c) => c.legalBasis === 'EDYCJA-E2E'))
    check('podstawa: obie sekcje w eksporcie', exp.flashcards.some((c) => c.legalBasis?.includes('sprawach nieletnich')) && exp.flashcards.some((c) => c.legalBasis?.includes('przemocy domowej')))
    check('podstawa: karta bez podstawy pomija pole', exp.flashcards.some((c) => !('legalBasis' in c)))
  }

  // adres NAS z powrotem na localhost → QR wskazuje realny URL paczki
  await page.goto(`${BASE}/?view=ustawienia`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.settings-grid')
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('.settings-card label')].find((l) => l.textContent.includes('Adres bazowy'))
    const input = label.querySelector('input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'http://localhost:5173')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickButton(page, 'Zapisz ustawienia')
  await sleep(300)

  await page.goto(`${BASE}/?paczka=1`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.pack-editor')
  await clickButton(page, 'Plakat z QR')
  await page.waitForSelector('.poster-url')
  const posterUrl = (await page.$eval('.poster-url', (el) => el.textContent.trim()))
  check('QR: adres na plakacie = URL paczki', posterUrl === `${BASE}/?pakiet=1`, posterUrl)
  await page.$eval('.poster-modal .modal-close', (el) => el.click())

  // skan QR → słuchacz otwiera tę samą paczkę
  await learner.goto(posterUrl, { waitUntil: 'networkidle0' })
  await learner.waitForSelector('.flashcard', { timeout: 15000 })
  check('QR: link z plakatu otwiera paczkę u słuchacza', await learner.$eval('h1', (el, t) => el.textContent.includes(t), packTitle))

  // chip podstawy w PWA — paczka 10 z NAS
  await learner.goto(`${BASE}/?pakiet=10`, { waitUntil: 'networkidle0' })
  await learner.waitForSelector('.flashcard', { timeout: 15000 })
  check('PWA: paczka 10 pobrana z NAS', await learner.$eval('h1', (el) => el.textContent.includes('podstaw prawnych')))
  check('PWA: karta nieodkryta przed „Pokaż odpowiedź"', !(await learner.$eval('.flashcard', (el) => el.classList.contains('revealed'))))
  await clickButton(learner, 'Pokaż odpowiedź')
  await sleep(600)
  check('PWA: chip z podstawą na odwrocie', await learner.$eval('.legal-basis-chip', (el) => el.textContent.includes('Art. 15 ustawy z dnia 6 kwietnia 1990')))
  await clickButton(learner, 'Pamiętam')
  await sleep(400)
  await clickButton(learner, 'Pokaż odpowiedź')
  await sleep(600)
  check('PWA: brak chipa gdy fiszka nie ma podstawy', (await learner.$('.legal-basis-chip')) === null)

  await learner.close()
} finally {
  await browser.close()
}

console.log(`\n${failures === 0 ? 'WSZYSTKIE TESTY PRZESZŁY' : `${failures} BŁĘDÓW`}`)
process.exit(failures === 0 ? 0 : 1)
