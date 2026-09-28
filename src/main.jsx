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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
