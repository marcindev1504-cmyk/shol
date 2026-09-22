import { describe, expect, it } from 'vitest'
import { defaultSettings, firstName, greeting, initials, normalizeSettings } from './settings'

describe('normalizeSettings', () => {
  it('returns defaults for malformed values', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings)
    expect(normalizeSettings('x')).toEqual(defaultSettings)
    expect(normalizeSettings({ instructorName: 42 })).toEqual(defaultSettings)
  })

  it('keeps provided names and trims whitespace', () => {
    expect(normalizeSettings({ instructorName: '  Anna Kowal ', workspaceName: ' Szpital ', shareBaseUrl: ' http://nas/kompas/ ', generatorMode: 'model', aiModel: 'gemma3:12b', ollamaHost: ' http://192.168.1.50:11434/ ' })).toEqual({ ...defaultSettings, instructorName: 'Anna Kowal', workspaceName: 'Szpital', shareBaseUrl: 'http://nas/kompas/', generatorMode: 'model', aiModel: 'gemma3:12b', ollamaHost: 'http://192.168.1.50:11434' })
  })

  it('falls back per-field when a name is empty', () => {
    expect(normalizeSettings({ instructorName: '   ', workspaceName: 'Jednostka' })).toEqual({ ...defaultSettings, workspaceName: 'Jednostka' })
  })

  it('keeps any non-empty model name and falls back on empty', () => {
    expect(normalizeSettings({ aiModel: 'llama3.1:8b' }).aiModel).toBe('llama3.1:8b')
    expect(normalizeSettings({ aiModel: '   ' }).aiModel).toBe(defaultSettings.aiModel)
  })

  it('keeps whitelisted cardsPerSource values and falls back otherwise', () => {
    expect(normalizeSettings({ cardsPerSource: 24 }).cardsPerSource).toBe(24)
    expect(normalizeSettings({ cardsPerSource: 13 }).cardsPerSource).toBe(defaultSettings.cardsPerSource)
    expect(normalizeSettings({ cardsPerSource: '24' }).cardsPerSource).toBe(defaultSettings.cardsPerSource)
  })
})

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Marcin Wrona')).toBe('MW')
    expect(initials('anna')).toBe('A')
    expect(initials('  ')).toBe('KW')
  })
})

describe('greeting', () => {
  it('switches between morning and evening', () => {
    expect(greeting(new Date(2026, 8, 19, 9))).toBe('Dzień dobry')
    expect(greeting(new Date(2026, 8, 19, 20))).toBe('Dobry wieczór')
    expect(greeting(new Date(2026, 8, 19, 4))).toBe('Dobry wieczór')
  })
})

describe('firstName', () => {
  it('returns the first word', () => {
    expect(firstName('Marcin Wrona')).toBe('Marcin')
  })
})
