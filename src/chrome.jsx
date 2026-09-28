// Piezas de la "carcasa" de la app: aviso flotante, indicador en directo,
// hoja de ajustes y pantalla de bloqueo con Face ID.
import { useEffect, useRef, useState } from 'react'
import { backend } from './lib/backend.js'
import { lockAvailable, lockEnabled, enableLock, disableLock, unlock, bioName } from './lib/lock.js'
import { ThemeToggle } from './theme.jsx'
import { Avatar } from './components.jsx'
import { BrandSplash } from './burning.jsx'
import { Icon } from './icons.jsx'

// ---- Aviso flotante ("Proyecto creado") ------------------------------------
export function useToast() {
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])
  const notify = (msg) => setToast({ msg, id: Date.now() })
  const node = toast && (
    <div key={toast.id} className="toast" role="status">
      <span className="toast-check">✓</span>
      {toast.msg}
    </div>
  )
  return [notify, node]
}

// ---- Indicador "En directo" (y botón de refrescar) --------------------------
const LIVE_TEXT = { live: 'En directo', connecting: 'Conectando…', offline: 'Sin conexión' }

export function LivePill({ status, onRefresh }) {
  const [spinning, setSpinning] = useState(false)
  const click = async () => {
    setSpinning(true)
    await onRefresh()
    setTimeout(() => setSpinning(false), 400)
  }
  return (
    <button className={`live-pill ${status}${spinning ? ' spinning' : ''}`} onClick={click}
      title="Los cambios del otro aparecen solos. Toca para refrescar." aria-label={`${LIVE_TEXT[status]}. Refrescar`}>
      <i />
      {LIVE_TEXT[status]}
    </button>
  )
}

// ---- Hoja de ajustes (al tocar tu avatar) ----------------------------------
export function SettingsSheet({ me, user, role, onClose, notify }) {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(() => lockEnabled(user.id))
  const [busy, setBusy] = useState(false)

  useEffect(() => { lockAvailable().then(setAvailable) }, [])

  const toggleLock = async () => {
    if (enabled) {
      disableLock(user.id)
      setEnabled(false)
      notify(`${bioName} desactivado`)
      return
    }
    setBusy(true)
    try {
      await enableLock(user, me.name)
      setEnabled(true)
      notify(`${bioName} activado`)
    } catch {
      notify(`No se ha activado ${bioName}`)
    }
    setBusy(false)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ajustes">
        <div className="sheet-grip" />
        <div className="sheet-user">
          <Avatar profile={me} />
          <span className="me-name">{me.name}<small>{role} · {user.email}</small></span>
        </div>

        <div className="sheet-row">
          <span>
            <strong>Entrar con {bioName}</strong>
            <small>{available ? 'Se pedirá al abrir la app' : 'No disponible en este dispositivo o navegador'}</small>
          </span>
          <button className={enabled ? 'switch on' : 'switch'} disabled={!available || busy} onClick={toggleLock}
            role="switch" aria-checked={enabled} aria-label={`Entrar con ${bioName}`}><i /></button>
        </div>

        <div className="sheet-row">
          <span><strong>Tema</strong><small>Claro u oscuro</small></span>
          <ThemeToggle />
        </div>

        <button className="sheet-logout" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && backend.signOut()}>
          <Icon name="logout" size={18} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// ---- Sugerencia para activar Face ID (una sola vez) -------------------------
export function FaceIdPrompt({ me, user, notify }) {
  const key = `splice-faceid-offer-${user.id}`
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try { dismissed = !!localStorage.getItem(key) } catch { /* sin almacenamiento */ }
    if (dismissed || lockEnabled(user.id)) return
    lockAvailable().then(setShow)
  }, [key, user.id])
  if (!show) return null
  const close = () => {
    try { localStorage.setItem(key, '1') } catch { /* sin almacenamiento */ }
    setShow(false)
  }
  const activate = async () => {
    try {
      await enableLock(user, me.name)
      notify(`${bioName} activado`)
      close()
    } catch {
      notify(`No se ha activado ${bioName}`)
    }
  }
  return (
    <div className="install-hint faceid-offer" role="note">
      <strong>¿Entrar con {bioName}?</strong>
      <span>Al abrir la app te pedirá {bioName} para entrar. Puedes cambiarlo cuando quieras tocando tu avatar.</span>
      <div className="row">
        <button className="small" onClick={activate}>Activar</button>
        <button className="small ghost" onClick={close}>Ahora no</button>
      </div>
    </div>
  )
}

// ---- Pantalla de bloqueo ------------------------------------------------------
const RELOCK_AFTER = 5 * 60 * 1000 // vuelve a pedir Face ID tras 5 min en segundo plano

export function useLock(user) {
  const [locked, setLocked] = useState(() => lockEnabled(user.id))
  const hiddenAt = useRef(null)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER && lockEnabled(user.id)) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user.id])
  return [locked, () => setLocked(false)]
}

export function LockScreen({ user, onUnlock }) {
  const [state, setState] = useState('idle') // idle | checking | failed | leaving
  const tried = useRef(false)

  const attempt = async () => {
    setState('checking')
    try {
      await unlock(user.id)
      setState('leaving')
      setTimeout(onUnlock, 420)
    } catch {
      setState('failed')
    }
  }

  // Pide Face ID nada más abrir; si el sistema exige un toque, queda el botón
  useEffect(() => {
    if (tried.current) return
    tried.current = true
    attempt()
  })

  return (
    <BrandSplash leaving={state === 'leaving'}>
      {state === 'failed' && <p className="splash-msg">No se ha podido verificar</p>}
      {state !== 'leaving' && (
        <>
          <button className="splash-btn" onClick={attempt} disabled={state === 'checking'}>
            <svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 16V10a4 4 0 0 1 4-4h6M32 6h6a4 4 0 0 1 4 4v6M42 32v6a4 4 0 0 1-4 4h-6M16 42h-6a4 4 0 0 1-4-4v-6" />
              <path d="M17 18v3M31 18v3M24 18v9h-2M18 33c3.5 3 8.5 3 12 0" />
            </svg>
            {state === 'checking' ? 'Verificando…' : `Entrar con ${bioName}`}
          </button>
          <button className="splash-link" onClick={() => confirm('Se cerrará la sesión y podrás entrar con tu contraseña. ¿Seguir?') && backend.signOut()}>
            Usar contraseña
          </button>
        </>
      )}
    </BrandSplash>
  )
}
