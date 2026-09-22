import { describe, expect, it } from 'vitest'
import { containsQuote, createSource, detectLegalBasis, draftsFromSource, legalBasisForSentence, questionFor, sourceSentences } from './sources'

const longSentence = 'Policjant legitymując osobę podaje swój stopień, imię i nazwisko oraz przyczynę czynności.'
const secondSentence = 'Osoba legitymowana ma prawo zażądać okazania legitymacji służbowej policjanta.'

function source(content = `${longSentence} Krótko. ${secondSentence}`) {
  return createSource('ustawa.txt', content)
}

describe('sourceSentences', () => {
  it('splits on sentence-ending punctuation and drops sentences under 45 chars', () => {
    const sentences = sourceSentences(source())
    expect(sentences).toEqual([longSentence, secondSentence])
  })

  it('caps the result at 400 sentences', () => {
    const many = Array.from({ length: 405 }, (_, index) => `Zdanie numer ${index} z wystarczająco długą treścią do fiszki.`).join(' ')
    expect(sourceSentences(source(many))).toHaveLength(400)
  })
})

describe('containsQuote', () => {
  it('ignores whitespace and case differences', () => {
    const noisy = longSentence.split(' ').join('   ').toUpperCase()
    expect(containsQuote(source(), noisy)).toBe(true)
  })

  it('rejects quotes shorter than 20 chars and quotes absent from the source', () => {
    expect(containsQuote(source(), 'zbyt krótki cytat')).toBe(false)
    expect(containsQuote(source(), 'To zdanie w ogóle nie występuje w treści dokumentu źródłowego.')).toBe(false)
  })
})

describe('questionFor', () => {
  it('tworzy pytanie „Co oznacza" dla definicji', () => {
    expect(questionFor('Legitymacja służbowa to dokument potwierdzający tożsamość policjanta.', 'x')).toBe('Co oznacza „Legitymacja służbowa”?')
  })

  it('tworzy pytanie o uprawnienie dla „ma prawo"', () => {
    expect(questionFor('Osoba legitymowana ma prawo zażądać okazania legitymacji służbowej.', 'x')).toBe('Jakie uprawnienie ma osoba legitymowana?')
  })

  it('tworzy pytanie o obowiązek z zachowaniem rodzaju gramatycznego', () => {
    expect(questionFor('Policjant jest obowiązany powstrzymać się od nadmiernych czynności.', 'x')).toBe('Do czego policjant jest obowiązany?')
    expect(questionFor('Osoba legitymowana jest obowiązana poddać się czynności.', 'x')).toBe('Do czego osoba legitymowana jest obowiązana?')
  })

  it('tworzy pytanie „Kiedy" dla warunku', () => {
    expect(questionFor('Legitymowanie może nastąpić wyłącznie w przypadkach określonych w ustawie.', 'x')).toBe('Kiedy legitymowanie może nastąpić?')
  })

  it('tworzy pytanie o skutek dla „może skutkować"', () => {
    expect(questionFor('Odmowa poddania się legitymowaniu może skutkować doprowadzeniem do jednostki.', 'x')).toBe('Czym może skutkować odmowa poddania się legitymowaniu?')
  })

  it('tworzy pytanie „Czego nie może" dla zakazu', () => {
    expect(questionFor('Policjant nie może ujawniać danych osobowych bez podstawy prawnej.', 'x')).toBe('Czego nie może policjant?')
  })

  it('dla zwykłego zdania tworzy klauzulę cloze z ukrytym kluczowym słowem', () => {
    const q = questionFor('Policjant podaje osobie legitymowanej swój stopień, imię i nazwisko oraz przyczynę czynności.', 'x')
    expect(q).toContain('______')
    expect(q).toContain('Policjant podaje osobie')
    expect(q).not.toContain('legitymowanej')
  })

  it('ignoruje reguły dla zbyt długiego podmiotu i przechodzi do cloze', () => {
    const q = questionFor('Bardzo długie i rozbudowane wyrażenie wielowyrazowe przekraczające sześć słów ma prawo istnieć.', 'x')
    expect(q).toContain('______')
  })
})

describe('detectLegalBasis / legalBasisForSentence', () => {
  const multiAct = [
    'Policjant interweniujący w sytuacji przemocy domowej jest obowiązany ustalić zagrożenie dla osób poszkodowanych.',
    'Ustawa z dnia 29 lipca 2005 r. o przeciwdziałaniu przemocy domowej określa procedurę Niebieskiej Karty.',
    'Osoba stosująca przemoc domową może być zatrzymana, jeżeli istnieje obawa kontynuowania przemocy.',
    'Postępowanie w sprawach nieletnich reguluje ustawa z dnia 26 października 1982 r. o postępowaniu w sprawach nieletnich.',
    'Odpowiedzialność nieletniego za czyn zabroniony powstaje po ukończeniu trzynastego roku życia.',
  ].join('\n')

  it('wykrywa pierwszą podstawę prawną w dokumencie', () => {
    expect(detectLegalBasis(multiAct)).toContain('przeciwdziałaniu przemocy domowej')
  })

  it('przypisuje fiszce najbliższą poprzedzającą podstawę, nie pierwszą w dokumencie', () => {
    expect(legalBasisForSentence(multiAct, 'Osoba stosująca przemoc domową może być zatrzymana, jeżeli istnieje obawa kontynuowania przemocy.')).toContain('przeciwdziałaniu przemocy domowej')
    expect(legalBasisForSentence(multiAct, 'Odpowiedzialność nieletniego za czyn zabroniony powstaje po ukończeniu trzynastego roku życia.')).toContain('postępowaniu w sprawach nieletnich')
  })

  it('dopasowuje podstawę także dla fragmentu zdania (cytat AI)', () => {
    expect(legalBasisForSentence(multiAct, 'Odpowiedzialność nieletniego za czyn zabroniony powstaje po ukończeniu trzynastego roku')).toContain('postępowaniu w sprawach nieletnich')
  })

  it('fiszki z różnych sekcji dokumentu dziedziczą właściwe podstawy', () => {
    const drafts = draftsFromSource(createSource('dwie-ustawy.txt', multiAct), 1, 8)
    const domestic = drafts.find((draft) => draft.answer.includes('przemoc domową może być zatrzymana'))
    const juvenile = drafts.find((draft) => draft.answer.includes('trzynastego roku życia'))
    expect(domestic?.legalBasis).toContain('przeciwdziałaniu przemocy domowej')
    expect(juvenile?.legalBasis).toContain('postępowaniu w sprawach nieletnich')
  })
})

describe('draftsFromSource', () => {
  it('returns at most `limit` drafts with review status and the given packId', () => {
    const many = Array.from({ length: 10 }, (_, index) => `Zdanie numer ${index} z wystarczająco długą treścią do fiszki.`).join(' ')
    const drafts = draftsFromSource(source(many), 7, 3)
    expect(drafts).toHaveLength(3)
    for (const draft of drafts) {
      expect(draft.status).toBe('Do weryfikacji')
      expect(draft.packId).toBe(7)
      expect(draft.id).toBeTruthy()
      expect(draft.question).not.toContain('fragmentu')
    }
  })

  it('samples sentences evenly across the whole document, not just the beginning', () => {
    const many = Array.from({ length: 10 }, (_, index) => `Zdanie numer ${index} z wystarczająco długą treścią do fiszki.`).join(' ')
    const drafts = draftsFromSource(source(many), 7, 3)
    expect(drafts[0]!.answer).toContain('numer 0')
    expect(drafts[1]!.answer).toContain('numer 3')
    expect(drafts[2]!.answer).toContain('numer 6')
  })
})
