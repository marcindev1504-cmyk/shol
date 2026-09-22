export type PackStatus = 'Do weryfikacji' | 'Zatwierdzone'

export type Flashcard = {
  id: string
  question: string
  answer: string
  source: string
  legalBasis?: string
  status: PackStatus
  packId: number
}

export type Pack = {
  id: number
  title: string
  subject: string
  updated: string
  status: PackStatus
  color: 'mint' | 'orange' | 'blue' | 'violet' | 'rose' | 'amber'
  flashcards: Flashcard[]
}

export function createFlashcard(fields: Omit<Flashcard, 'id' | 'status'> & { status?: PackStatus }): Flashcard {
  return { ...fields, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: fields.status ?? 'Do weryfikacji' }
}

export const initialPacks: Pack[] = [
  {
    id: 1, title: 'Legitymowanie i ustalanie tożsamości', subject: 'Podstawy służby', updated: 'dzisiaj, 09:24', status: 'Do weryfikacji', color: 'mint',
    flashcards: [
      createFlashcard({ question: 'Co policjant podaje osobie legitymowanej zgodnie z art. 15 ustawy o Policji?', answer: 'Policjant podaje swój stopień, imię i nazwisko oraz przyczynę podjęcia czynności, a także podstawę prawną jej podjęcia.', source: 'Ustawa o Policji, art. 15', status: 'Zatwierdzone', packId: 1 }),
      createFlashcard({ question: 'Czy osoba legitymowana może zażądać okazania legitymacji służbowej?', answer: 'Tak — na żądanie osoby legitymowanej policjant okazuje legitymację służbową w sposób umożliwiający odczytanie danych.', source: 'Ustawa o Policji, art. 15', status: 'Zatwierdzone', packId: 1 }),
      createFlashcard({ question: 'W jakich przypadkach policjant może legitymować osobę?', answer: 'Gdy zachodzi uzasadniona potrzeba ustalenia tożsamości w celu wykonania zadania, np. wobec osoby podejrzanej o przestępstwo lub wykroczenie.', source: 'Ustawa o Policji, art. 15', status: 'Zatwierdzone', packId: 1 }),
    ],
  },
  {
    id: 2, title: 'Środki przymusu bezpośredniego', subject: 'Taktyka i technika interwencji', updated: 'wczoraj, 15:40', status: 'Zatwierdzone', color: 'orange',
    flashcards: [
      createFlashcard({ question: 'Jakie zasady ograniczają stosowanie środków przymusu bezpośredniego?', answer: 'Środki używa się tylko w zakresie niezbędnym do osiągnięcia celu interwencji i przy minimalizacji szkód oraz następstw dla zdrowia.', source: 'Ustawa o ŚPD z 24.05.2013, art. 11', status: 'Zatwierdzone', packId: 2 }),
      createFlashcard({ question: 'Kiedy należy zaprzestać użycia środków przymusu bezpośredniego?', answer: 'Niezwłocznie po ustaniu powodującego użycie zachowania lub po osiągnięciu celu interwencji.', source: 'Ustawa o ŚPD z 24.05.2013, art. 11', status: 'Zatwierdzone', packId: 2 }),
    ],
  },
  {
    id: 3, title: 'Pierwsza pomoc przedmedyczna', subject: 'Szkolenie ogólne', updated: '12 wrz 2026', status: 'Zatwierdzone', color: 'blue',
    flashcards: [
      createFlashcard({ question: 'Jaki jest schemat resuscytacji krążeniowo-oddechowej (RKO) u osoby dorosłej?', answer: '30 uciśnięć klatki piersiowej na 2 oddechy zastane, z częstością 100–120 uciśnięć na minutę i głębokością 5–6 cm.', source: 'Wytyczne ERC 2021, RKO podstawowa', status: 'Zatwierdzone', packId: 3 }),
      createFlashcard({ question: 'Kiedy poszkodowanego układa się w pozycji bocznej ustalonej?', answer: 'Gdy poszkodowany jest nieprzytomny, ale oddycha prawidłowo — pozycja boczna zabezpiecza drogi oddechowe przed zadławieniem.', source: 'Wytyczne ERC 2021, pierwsza pomoc', status: 'Zatwierdzone', packId: 3 }),
    ],
  },
]

export function normalizePack(value: unknown): Pack | null {
  if (!value || typeof value !== 'object') return null
  const pack = value as Partial<Pack> & { version?: string }
  const valid = typeof pack.id === 'number' && typeof pack.title === 'string' && typeof pack.subject === 'string' && (pack.status === 'Do weryfikacji' || pack.status === 'Zatwierdzone')
  if (!valid) return null
  const color = packColors.includes(pack.color as Pack['color']) ? pack.color as Pack['color'] : 'mint'
  const updated = typeof pack.updated === 'string' && pack.updated ? pack.updated : pack.version ?? ''
  return { id: pack.id!, title: pack.title!, subject: pack.subject!, updated, status: pack.status!, color, flashcards: Array.isArray(pack.flashcards) ? pack.flashcards : [] }
}

export function readPacks(storage: Storage = localStorage): Pack[] {
  try {
    const raw = storage.getItem('kompas:packs')
    if (!raw) return initialPacks
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return initialPacks
    const packs = parsed.map(normalizePack)
    return packs.every((pack): pack is Pack => pack !== null) ? packs : initialPacks
  } catch {
    return initialPacks
  }
}

export function readApprovedQuestions(storage: Storage = localStorage): string[] {
  try {
    const raw = storage.getItem('kompas:approved')
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string') ? parsed : []
  } catch {
    return []
  }
}

export function approveDraft(packs: Pack[], draft: Flashcard, updatedLabel: string): Pack[] {
  const target = packs.find((pack) => pack.id === draft.packId)
  if (!target) return packs
  return packs.map((pack) => pack.id === draft.packId
    ? { ...pack, updated: updatedLabel, flashcards: pack.flashcards.some((card) => card.id === draft.id) ? pack.flashcards : [...pack.flashcards, { ...draft, status: 'Zatwierdzone' as PackStatus }] }
    : pack)
}

export const packColors: Pack['color'][] = ['mint', 'orange', 'blue', 'violet', 'rose', 'amber']

export const packColorLabels: Record<Pack['color'], string> = { mint: 'Miętowa', orange: 'Pomarańczowa', blue: 'Niebieska', violet: 'Fioletowa', rose: 'Różowa', amber: 'Bursztynowa' }
export const packColorSymbols: Record<Pack['color'], string> = { mint: '◈', orange: '◉', blue: '△', violet: '⬡', rose: '✳', amber: '▽' }

export function nextPackId(packs: Pick<Pack, 'id'>[]): number {
  const used = new Set(packs.map((pack) => pack.id))
  let id = 0
  do {
    id = 10000 + Math.floor(Math.random() * 990000)
  } while (used.has(id))
  return id
}

export function createPack(packs: Pack[], title: string, subject: string, updatedLabel: string): Pack {
  return { id: nextPackId(packs), title, subject, updated: updatedLabel, status: 'Do weryfikacji', color: packColors[packs.length % packColors.length], flashcards: [] }
}

export function formatUpdatedLabel(date = new Date()): string {
  return `dzisiaj, ${date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
