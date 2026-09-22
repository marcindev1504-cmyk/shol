import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--no-default-browser-check'] })

async function clickButton(page, text) {
  await page.evaluate((label) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes(label))
    button?.click()
  }, text)
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 })

  const shot = async (name) => { await new Promise((r) => setTimeout(r, 700)); await page.screenshot({ path: `public/docs/${name}.png` }); console.log(`saved ${name}.png`) }

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.pack-grid', { timeout: 10000 })
  await shot('paczki')

  await page.goto(`${BASE}/?paczka=1`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.card-editor-list')
  await shot('edytor')

  await clickButton(page, 'Generuj ze źródła')
  await page.waitForSelector('.generator-modal')
  const fileInput = await page.$('.generator-modal .file-button input')
  await fileInput.uploadFile('scripts/fixtures/ustawa.txt')
  await page.waitForSelector('.generator-modal .source-select')
  await page.click('.generator-modal .source-select')
  await page.waitForSelector('.confirm-source input')
  await page.click('.confirm-source input')
  await clickButton(page, 'Generuj propozycje')
  await page.waitForSelector('.proposal-list')
  await shot('generator')

  await page.goto(`${BASE}/?paczka=2`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.card-editor-list')
  await clickButton(page, 'Plakat z QR')
  await page.waitForSelector('.poster-canvas')
  await new Promise((r) => setTimeout(r, 1200))
  await shot('plakat')

  await page.goto(`${BASE}/?view=sluchacze`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.library-list')
  await shot('sluchacze')

  await page.goto(`${BASE}/?view=ustawienia`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.settings-grid')
  await shot('ustawienia')

  await page.goto(`${BASE}/?view=instrukcja`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.manual-toc')
  await shot('instrukcja')

  await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/?pakiet=1`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.flashcard')
  await shot('tryb-sluchacza')

  await clickButton(page, 'Pokaż odpowiedź')
  await new Promise((r) => setTimeout(r, 800))
  await shot('tryb-sluchacza-odpowiedz')

  for (let i = 0; i < 3; i++) {
    await clickButton(page, 'Pamiętam')
    await new Promise((r) => setTimeout(r, 500))
    if (i < 2) { await clickButton(page, 'Pokaż odpowiedź'); await new Promise((r) => setTimeout(r, 600)) }
  }
  await page.waitForSelector('.summary-card', { timeout: 8000 })
  await shot('podsumowanie-sluchacza')

  await page.goto(`${BASE}/?pakiet=`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.learner-pack-list')
  await shot('biblioteka-sluchacza')
} finally {
  await browser.close()
}
