import { initialPacks, normalizePack, readApprovedQuestions, readPacks, type Flashcard, type Pack } from '../domain/packs'
import { defaultSettings, normalizeSettings, type AppSettings } from '../domain/settings'
import type { Source } from '../domain/sources'

const DATABASE_NAME = 'kompas-wiedzy'
const DATABASE_VERSION = 3
const PACK_STORE = 'packs'
const SETTINGS_STORE = 'settings'
const SOURCES_STORE = 'sources'
const PACKS_KEY = 'all'
const APPROVED_KEY = 'approved-questions'
const DRAFTS_KEY = 'drafts'
const SETTINGS_KEY = 'app-settings'
const PROGRESS_PREFIX = 'progress:'

let _dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PACK_STORE)) database.createObjectStore(PACK_STORE)
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) database.createObjectStore(SETTINGS_STORE)
      if (!database.objectStoreNames.contains(SOURCES_STORE)) database.createObjectStore(SOURCES_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { _dbPromise = null; reject(request.error) }
  })
  return _dbPromise
}

function read<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  }))
}

function write<T>(storeName: string, key: IDBValidKey, value: T): Promise<void> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }))
}

export async function loadPacks(): Promise<Pack[]> {
  try {
    const stored = await read<unknown[]>(PACK_STORE, PACKS_KEY)
    if (!Array.isArray(stored)) return initialPacks
    const packs = stored.map(normalizePack)
    return packs.every((pack): pack is Pack => pack !== null) ? packs : initialPacks
  } catch {
    return initialPacks
  }
}

export async function loadPack(id: number): Promise<Pack | undefined> {
  return (await loadPacks()).find((pack) => pack.id === id)
}

export async function savePacks(packs: Pack[]): Promise<void> {
  await write(PACK_STORE, PACKS_KEY, packs)
}

async function saveApprovedQuestions(questions: string[]): Promise<void> {
  await write(SETTINGS_STORE, APPROVED_KEY, questions)
}

export async function loadLegacyApprovedQuestions(): Promise<string[]> {
  try {
    return (await read<string[]>(SETTINGS_STORE, APPROVED_KEY)) ?? []
  } catch {
    return []
  }
}

export async function loadDrafts(): Promise<Flashcard[] | undefined> {
  try {
    return await read<Flashcard[]>(SETTINGS_STORE, DRAFTS_KEY)
  } catch {
    return undefined
  }
}

export async function saveDrafts(drafts: Flashcard[]): Promise<void> {
  await write(SETTINGS_STORE, DRAFTS_KEY, drafts)
}

export async function loadLearnerProgress(packId: number): Promise<number> {
  try {
    return (await read<number>(SETTINGS_STORE, `${PROGRESS_PREFIX}${packId}`)) ?? 0
  } catch {
    return 0
  }
}

export async function saveLearnerProgress(packId: number, cardIndex: number): Promise<void> {
  await write(SETTINGS_STORE, `${PROGRESS_PREFIX}${packId}`, cardIndex)
}

function remove(storeName: string, key: IDBValidKey): Promise<void> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }))
}

export async function clearLearnerProgress(packId: number): Promise<void> {
  try {
    await remove(SETTINGS_STORE, `${PROGRESS_PREFIX}${packId}`)
  } catch {
    // Progress is best-effort; a missing database must not block pack deletion.
  }
}

export async function loadAllProgress(packIds: number[]): Promise<Record<number, number>> {
  if (packIds.length === 0) return {}
  try {
    const database = await openDatabase()
    return await new Promise<Record<number, number>>((resolve, reject) => {
      const transaction = database.transaction(SETTINGS_STORE, 'readonly')
      const store = transaction.objectStore(SETTINGS_STORE)
      const keysReq = store.getAllKeys()
      keysReq.onsuccess = () => {
        const keys = keysReq.result.filter(
          (k): k is string => typeof k === 'string' && k.startsWith(PROGRESS_PREFIX) && packIds.includes(Number(k.slice(PROGRESS_PREFIX.length)))
        )
        const progress: Record<number, number> = {}
        if (keys.length === 0) { resolve(progress); return }
        let pending = keys.length
        for (const key of keys) {
          const packId = Number(key.slice(PROGRESS_PREFIX.length))
          const req = store.get(key)
          req.onsuccess = () => {
            if (typeof req.result === 'number') progress[packId] = req.result
            if (--pending === 0) resolve(progress)
          }
          req.onerror = () => reject(req.error)
        }
      }
      keysReq.onerror = () => reject(keysReq.error)
    })
  } catch {
    return {}
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    return normalizeSettings(await read<unknown>(SETTINGS_STORE, SETTINGS_KEY))
  } catch {
    return defaultSettings
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await write(SETTINGS_STORE, SETTINGS_KEY, settings)
}

export async function exportAllData(): Promise<string> {
  const [packs, sources, drafts, settings] = await Promise.all([loadPacks(), loadSources(), loadDrafts(), loadAppSettings()])
  const progress = await loadAllProgress(packs.map((pack) => pack.id))
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, packs, sources, drafts: drafts ?? [], progress }, null, 2)
}

export async function clearAllData(): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PACK_STORE, SETTINGS_STORE, SOURCES_STORE], 'readwrite')
    for (const storeName of [PACK_STORE, SETTINGS_STORE, SOURCES_STORE]) transaction.objectStore(storeName).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  localStorage.removeItem('kompas:packs')
  localStorage.removeItem('kompas:approved')
}

const LEARNER_PACKS_KEY = 'learner-packs'

export async function loadLearnerPacks(): Promise<Pack[]> {
  try {
    const stored = await read<unknown[]>(SETTINGS_STORE, LEARNER_PACKS_KEY)
    if (!Array.isArray(stored)) return []
    const packs = stored.map(normalizePack)
    return packs.filter((pack): pack is Pack => pack !== null)
  } catch {
    return []
  }
}

export async function saveLearnerPacks(packs: Pack[]): Promise<void> {
  await write(SETTINGS_STORE, LEARNER_PACKS_KEY, packs)
}

export async function upsertLearnerPack(pack: Pack): Promise<void> {
  const packs = await loadLearnerPacks()
  const index = packs.findIndex((item) => item.id === pack.id)
  if (index >= 0) packs[index] = pack
  else packs.push(pack)
  await saveLearnerPacks(packs)
}

export async function removeLearnerPack(packId: number): Promise<void> {
  const packs = await loadLearnerPacks()
  await saveLearnerPacks(packs.filter((pack) => pack.id !== packId))
}

export async function loadSources(): Promise<Source[]> {
  try {
    return (await read<Source[]>(SOURCES_STORE, 'all')) ?? []
  } catch {
    return []
  }
}

export async function saveSources(sources: Source[]): Promise<void> {
  await write(SOURCES_STORE, 'all', sources)
}

export async function migrateLegacyStorage(): Promise<void> {
  if (!localStorage.getItem('kompas:packs') && !localStorage.getItem('kompas:approved')) return
  try {
    if (localStorage.getItem('kompas:packs')) await savePacks(readPacks())
    if (localStorage.getItem('kompas:approved')) await saveApprovedQuestions(readApprovedQuestions())
    localStorage.removeItem('kompas:packs')
    localStorage.removeItem('kompas:approved')
  } catch {
    // Keep legacy values when migration cannot complete.
  }
}
