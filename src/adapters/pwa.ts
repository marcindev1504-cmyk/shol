type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredPrompt = event as BeforeInstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  notify()
})

export function pwaInstallable() {
  return deferredPrompt !== null
}

export function pwaInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches
}

export function onPwaInstallChange(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export async function installPwa(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const prompt = deferredPrompt
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  deferredPrompt = null
  notify()
  return outcome
}
