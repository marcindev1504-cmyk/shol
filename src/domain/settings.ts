export const AI_MODELS = ['qwen3:4b', 'qwen3:8b', 'gemma3:12b'] as const
export const CARDS_PER_SOURCE_OPTIONS = [8, 16, 24, 32, 40] as const

export type AppSettings = {
  instructorName: string
  workspaceName: string
  shareBaseUrl: string
  generatorMode: 'deterministic' | 'model'
  aiModel: string
  ollamaHost: string
  cardsPerSource: number
}

export const defaultSettings: AppSettings = {
  instructorName: 'Marcin',
  workspaceName: 'Szkoła Policji',
  shareBaseUrl: '',
  generatorMode: 'deterministic',
  aiModel: 'qwen3:4b',
  ollamaHost: '',
  cardsPerSource: 16,
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return defaultSettings
  const settings = value as Partial<AppSettings>
  return {
    instructorName: typeof settings.instructorName === 'string' && settings.instructorName.trim() ? settings.instructorName.trim() : defaultSettings.instructorName,
    workspaceName: typeof settings.workspaceName === 'string' && settings.workspaceName.trim() ? settings.workspaceName.trim() : defaultSettings.workspaceName,
    shareBaseUrl: typeof settings.shareBaseUrl === 'string' ? settings.shareBaseUrl.trim() : '',
    generatorMode: settings.generatorMode === 'model' ? 'model' : 'deterministic',
    aiModel: typeof settings.aiModel === 'string' && settings.aiModel.trim() ? settings.aiModel.trim() : defaultSettings.aiModel,
    ollamaHost: typeof settings.ollamaHost === 'string' ? settings.ollamaHost.trim().replace(/\/+$/, '') : '',
    cardsPerSource: typeof settings.cardsPerSource === 'number' && (CARDS_PER_SOURCE_OPTIONS as readonly number[]).includes(settings.cardsPerSource) ? settings.cardsPerSource : defaultSettings.cardsPerSource,
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || 'KW'
}

export function greeting(date = new Date()): string {
  return date.getHours() >= 5 && date.getHours() < 18 ? 'Dzień dobry' : 'Dobry wieczór'
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

export function packShareUrl(packId: number, settings: AppSettings, currentOrigin = window.location.origin): string {
  const base = settings.shareBaseUrl.replace(/\/+$/, '') || currentOrigin
  return `${base}/?pakiet=${packId}`
}

export function packFileUrl(packId: number): string {
  return `paczki/kompas-paczka-${packId}.json`
}
