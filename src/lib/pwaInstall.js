let deferredInstallPrompt = null

const notifyInstallChange = () => window.dispatchEvent(new Event('pwa-install-change'))

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event
  notifyInstallChange()
})

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null
  notifyInstallChange()
})

export const getInstallPrompt = () => deferredInstallPrompt

export const clearInstallPrompt = () => {
  deferredInstallPrompt = null
  notifyInstallChange()
}
