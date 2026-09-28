// Bloqueo con Face ID / Touch ID (WebAuthn con el autenticador del propio dispositivo).
// La sesión ya queda guardada en el dispositivo; esto añade una comprobación
// biométrica al abrir la app, como en las apps de banco. Todo ocurre en el
// dispositivo: el sistema operativo solo nos dice "verificado" o "cancelado".

const KEY = (uid) => `splice-faceid-${uid}`

// Nombre del sistema biométrico según el dispositivo
export const bioName = (() => {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  return 'huella o Face ID'
})()

const toB64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const challenge = () => crypto.getRandomValues(new Uint8Array(32))

export async function lockAvailable() {
  try {
    return !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

export const lockEnabled = (uid) => {
  try { return !!localStorage.getItem(KEY(uid)) } catch { return false }
}

export async function enableLock(user, displayName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'Splice', id: location.hostname },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.email ?? displayName,
        displayName: displayName ?? user.email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  })
  localStorage.setItem(KEY(user.id), toB64(cred.rawId))
}

export function disableLock(uid) {
  try { localStorage.removeItem(KEY(uid)) } catch { /* sin almacenamiento */ }
}

export async function unlock(uid) {
  const id = localStorage.getItem(KEY(uid))
  if (!id) return
  await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64(id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
}
