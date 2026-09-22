import { createFlashcard, type Flashcard } from './packs'

export type Source = {
  id: string
  title: string
  filename: string
  content: string
  version: string
  importedAt: string
  approved: boolean
  legalBasis?: string
}

function splitSentences(content: string): string[] {
  return content
    .split(/\n+/)
    .flatMap((line) => line.split(SENTENCE_SPLIT))
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 30)
}

const LEGAL_REFERENCE = /(art\.\s*\d|ustaw(a|y|ę|ie)\b|kodeks|rozporządzen|regulamin|wytyczn|konstytucj)/i

function isBasisSentence(sentence: string): boolean {
  return /(podstaw(ą|a\b|y\b|ę)|reguluje|regulują|określa|określają|normuje|opracowuje)/i.test(sentence)
    && LEGAL_REFERENCE.test(sentence)
}

export function detectLegalBasis(content: string): string {
  return splitSentences(content).find(isBasisSentence) ?? ''
}

export function makeLegalBasisLookup(content: string): (answer: string) => string {
  if (!LEGAL_REFERENCE.test(content)) return () => ''
  const sentences = splitSentences(content)
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
  const isBasis = sentences.map(isBasisSentence)
  const globalBasis = sentences.find((_s, i) => isBasis[i]) ?? ''
  return (answer: string): string => {
    if (LEGAL_REFERENCE.test(answer)) return ''
    const normalizedAnswer = normalize(answer)
    const index = sentences.findIndex((sentence) => {
      const n = normalize(sentence)
      return n === normalizedAnswer || n.includes(normalizedAnswer) || normalizedAnswer.includes(n)
    })
    for (let i = (index >= 0 ? index : sentences.length) - 1; i >= 0; i--) {
      if (isBasis[i]) return sentences[i]!
    }
    return globalBasis
  }
}

export function legalBasisForSentence(content: string, answer: string): string {
  return makeLegalBasisLookup(content)(answer)
}

export function createSource(filename: string, content: string, legalBasis?: string): Source {
  const cleanName = filename.replace(/\.[^.]+$/, '').trim() || 'Dokument bez nazwy'
  const detected = legalBasis ?? detectLegalBasis(content)
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: cleanName,
    filename,
    content: content.trim(),
    version: new Date().toISOString().slice(0, 10),
    importedAt: new Date().toISOString(),
    approved: false,
    ...(detected ? { legalBasis: detected } : {}),
  }
}

const SENTENCE_SPLIT = /(?<=[.!?])(?<!\b(?:r|art|ust|pkt|np|itp|itd|tzw|tj|nr|im|godz|min|al|in|pt|os|ul|pl|dn)\.)\s+/iu

export function sourceSentences(source: Source): string[] {
  return source.content
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 45)
    .slice(0, 400)
}

export function containsQuote(source: Source, quote: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
  const normalizedQuote = normalize(quote)
  return normalizedQuote.length >= 20 && normalize(source.content).includes(normalizedQuote)
}

const QUESTION_STOPWORDS = new Set(('oraz lub albo ani że aby by być jest są była było może musi dla przy przez pod nad bez także również każdy każda każde który która które którego tego temu jako innych inne ich jego jej siebie się tak co czy mimo według sposób sposobem sprawie sprawy celu wobec między wyłącznie tylko jeszcze bardzo można powinno').split(' '))

// === Ocena wartości informacyjnej zdania ===
const SCORE_OBLIGATION = /\b(obowiązany|obowiązana|zobowiązany|zobowiązana|musi|należy|powinien|powinna|powinno|wymaga|trzeba)\b/i
const SCORE_PROHIBITION = /\b(nie może|nie wolno|zabrania się|zakazuje się|jest zabronione)\b/i
const SCORE_PERMISSION = /\b(ma prawo|może żądać|jest uprawnion|jest upoważnion|ma możliwość|wolno)\b/i
const SCORE_DEFINITION = / to | oznacza | stanowi | polega na /i
const SCORE_RECOMMENDATION = /\b(rekomenduje|zaleca|odradza|sugeruje|ostrzega)\b/i
const SCORE_TRANSITION = /^(Oraz\b|A także\b|Natomiast\b|Jednak\b|Ponadto\b|Przy tym\b)/i

function scoreSentence(sentence: string): number {
  let score = 50
  if (SCORE_OBLIGATION.test(sentence)) score += 25
  if (SCORE_PROHIBITION.test(sentence)) score += 22
  if (SCORE_PERMISSION.test(sentence)) score += 20
  if (SCORE_DEFINITION.test(sentence)) score += 18
  if (SCORE_RECOMMENDATION.test(sentence)) score += 15
  if (/\b\d+\b/.test(sentence)) score += 8
  const len = sentence.length
  if (len >= 70 && len <= 220) score += 15
  else if (len < 60) score -= 10
  else if (len > 320) score -= 10
  if (SCORE_TRANSITION.test(sentence)) score -= 20
  if (isBasisSentence(sentence)) score -= 8
  return score
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function usableTerm(term: string): boolean {
  const words = term.trim().split(/\s+/)
  return words.length <= 6 && !/[,.;:!?]/.test(term) && !QUESTION_STOPWORDS.has(words[0]!.toLowerCase()) && !QUESTION_STOPWORDS.has(words[words.length - 1]!.toLowerCase())
}

const QUESTION_RULES: { re: RegExp; make: (term: string, verb: string) => string }[] = [
  { re: /^(.{3,70}?)\s+(to|oznacza|stanowi|określa)\s/i, make: (term) => `Co oznacza „${term.trim()}”?` },
  { re: /^(.{3,70}?)\s+(jest obowiązany|jest obowiązana|jest zobowiązany|jest zobowiązana)(?=\s|$)/i, make: (term, verb) => `Do czego ${lowerFirst(term.trim())} ${verb.toLowerCase()}?` },
  { re: /^(.{3,70}?)\s+(ma obowiązek|ma powinność|musi|powinien|powinna|jest obowiązana do)(?=\s|$)/i, make: (term) => `Jaki obowiązek ma ${lowerFirst(term.trim())}?` },
  { re: /^(.{3,70}?)\s+(ma prawo|może żądać|ma możliwość|jest uprawniony|jest uprawniona|jest upoważniony|jest upoważniona)(?=\s|$)/i, make: (term) => `Jakie uprawnienie ma ${lowerFirst(term.trim())}?` },
  { re: /^(.{3,70}?)\s+(nie może|nie wolno|nie powinien|nie powinna|nie można)(?=\s|$)/i, make: (term, verb) => `Czego ${verb.toLowerCase()} ${lowerFirst(term.trim())}?` },
  { re: /^(.{3,70}?)\s+(może skutkować|może prowadzić do|grozi)(?=\s|$)/i, make: (term) => `Czym może skutkować ${lowerFirst(term.trim())}?` },
  { re: /^(.{3,70}?)\s+(może nastąpić|może zostać|może być|może mieć miejsce|następuje)(?=\s|$)/i, make: (term, verb) => `Kiedy ${lowerFirst(term.trim())} ${verb.toLowerCase()}?` },
  { re: /^(.{3,60}?)\s+(powinno)(?=\s|$)/i, make: (term) => `Jakie wymagania ma ${lowerFirst(term.trim())}?` },
  { re: /^(.{3,60}?)\s+(rekomenduje|zaleca|odradza)(?=\s|$)/i, make: (term, verb) => `Co ${verb.toLowerCase()} ${term.trim()}?` },
  { re: /^(.{3,60}?)\s+(wymaga)(?=\s|$)/i, make: (term) => `Czego wymaga ${lowerFirst(term.trim())}?` },
  { re: /^(.{3,60}?)\s+(umożliwia|pozwala)(?=\s|$)/i, make: (term) => `Co umożliwia ${lowerFirst(term.trim())}?` },
  { re: /^(.{5,60}?)\s+polega na\s+/i, make: (term) => `Na czym polega ${lowerFirst(term.trim())}?` },
]

function clozeQuestion(sentence: string, title: string): string {
  const words = [...sentence.matchAll(/[\p{L}][\p{L}-]{5,}/gu)]
  const candidates = words.filter((match) => (match.index ?? 0) > 0 && !QUESTION_STOPWORDS.has(match[0].toLowerCase()))
  const half = sentence.length / 2
  const best = candidates.sort((a, b) => {
    const sa = a[0].length + ((a.index ?? 0) >= half ? 3 : 0)
    const sb = b[0].length + ((b.index ?? 0) >= half ? 3 : 0)
    return sb - sa
  })[0]
  if (best) {
    const cloze = `${sentence.slice(0, best.index)}______${sentence.slice(best.index! + best[0].length)}`
    return `Uzupełnij brakujące słowo: „${cloze}”`
  }
  const splitAt = sentence.indexOf(' ', Math.floor(sentence.length / 2))
  const head = splitAt > 10 ? sentence.slice(0, splitAt) : sentence.slice(0, Math.floor(sentence.length / 2))
  return `Dokończ zapis z dokumentu „${title}”: „${head}…”`
}

export function questionFor(sentence: string, title: string): string {
  for (const rule of QUESTION_RULES) {
    const match = sentence.match(rule.re)
    if (match && usableTerm(match[1]!)) return rule.make(match[1]!, match[2]!)
  }
  return clozeQuestion(sentence, title)
}

export function draftsFromSource(source: Source, packId: number, limit = 5): Flashcard[] {
  const sentences = sourceSentences(source)
  const legalBasisFor = makeLegalBasisLookup(source.content)
  const picked = sentences.length <= limit
    ? sentences
    : Array.from({ length: limit }, (_, clusterIndex) => {
        const start = Math.floor(clusterIndex * sentences.length / limit)
        const end = Math.floor((clusterIndex + 1) * sentences.length / limit)
        // wybierz najlepiej ocenione zdanie z klastra; przy remisie wygrywa pierwsze (stabilny sort)
        return sentences.slice(start, end).reduce(
          (best, s) => scoreSentence(s) > scoreSentence(best) ? s : best,
          sentences[start]!,
        )
      })
  return picked.map((sentence) => createFlashcard({
    question: questionFor(sentence, source.title),
    answer: sentence,
    source: `${source.title}, wersja ${source.version}`,
    legalBasis: legalBasisFor(sentence) || undefined,
    packId,
  }))
}
