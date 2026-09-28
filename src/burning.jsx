// Marca Burning: logo (llama escalonada en dos piezas) y pantalla de arranque.
import { useEffect, useState } from 'react'

export function BurningLogo({ size = 64 }) {
  return (
    <svg viewBox="620 480 650 860" width={size * 0.756} height={size} fill="currentColor" aria-label="Burning" role="img">
      <path d="M950 493H1060V683H1150L1153 782L1252 783V949H636L635 797H747L749 687L849 686L850 592H950Z" />
      <path d="M638 990L1252 991V1154L1141 1155L1140 1260L1039 1261L1038 1326H836V1262H738L735 1192L638 1191Z" />
    </svg>
  )
}

// Logo + "Splice / by Burning". `children` se pinta debajo (p. ej. el botón de Face ID).
export function BrandSplash({ leaving, children }) {
  return (
    <div className={leaving ? 'splash-screen leaving' : 'splash-screen'}>
      <div className="splash-brand">
        <BurningLogo size={72} />
        <div className="splash-name">Splice</div>
        <div className="splash-by">by Burning</div>
      </div>
      {children && <div className="splash-actions">{children}</div>}
    </div>
  )
}

// Pantalla de arranque breve: se muestra al abrir y se desvanece sola
export function useBootSplash(ms = 900) {
  const [phase, setPhase] = useState('show') // show → leaving → gone
  useEffect(() => {
    // La versión estática de index.html ya se estaba viendo: la quitamos sin salto
    document.getElementById('boot')?.remove()
    const t1 = setTimeout(() => setPhase('leaving'), ms)
    const t2 = setTimeout(() => setPhase('gone'), ms + 450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [ms])
  return phase
}
