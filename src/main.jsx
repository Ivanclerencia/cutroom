import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// iOS solo aplica los estilos :active (efecto al pulsar) si hay un listener táctil
document.addEventListener('touchstart', () => {}, { passive: true })

// Guarda la app en el dispositivo para que se abra al instante (solo en la versión publicada)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

// Actualización automática: si se ha publicado una versión nueva, la app se recarga sola
// (al abrirla, al volver a ella y cada 5 minutos), salvo mientras escribes algo.
if (import.meta.env.PROD) {
  let reloading = false
  const check = async () => {
    if (reloading || document.visibilityState !== 'visible') return
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
      const { id } = await res.json()
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (id && id !== __BUILD_ID__ && !typing) {
        reloading = true
        location.reload()
      }
    } catch { /* sin conexión: ya se comprobará */ }
  }
  check()
  document.addEventListener('visibilitychange', check)
  setInterval(check, 5 * 60 * 1000)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
