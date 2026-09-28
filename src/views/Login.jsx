import { useState } from 'react'
import { backend, isDemo } from '../lib/backend.js'
import { ThemeToggle } from '../theme.jsx'
import { Brand, InstallHint } from '../components.jsx'

export default function Login({ appName }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await backend.signIn(email.trim(), password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-corner"><ThemeToggle /></div>
      <div className="login-card">
        <Brand name={appName} />
        <h1>Hola de nuevo</h1>
        <p className="muted">Proyectos, entregas y jornadas, sincronizados entre los dos.</p>

        <InstallHint />

        {isDemo ? (
          <div className="stack">
            <p className="hint">
              Modo demo (todavía no hay base de datos conectada). Elige con quién entrar; abre otra pestaña con el
              otro usuario para ver cómo se sincronizan los cambios.
            </p>
            {backend.demoUsers.map((u) => (
              <button key={u.id} onClick={() => backend.signIn(u.id)}>
                Entrar como {u.name} <span className="btn-sub">{u.role}</span>
              </button>
            ))}
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label>
              Email
              <input
                type="email" name="email" id="email" autoComplete="username" inputMode="email"
                autoCapitalize="none" autoCorrect="off" spellCheck="false"
                value={email} onChange={(e) => setEmail(e.target.value)} required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password" name="password" id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
            <p className="hint">La sesión queda iniciada en este dispositivo hasta que pulses “Salir”.</p>
          </form>
        )}
      </div>
    </div>
  )
}
