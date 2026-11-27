import { useEffect, useState } from 'react'
import { ref, onValue, off, push } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { FaCircleCheck, FaXmark } from 'react-icons/fa6'

const EVENT = 'avgh-qr-scan'
const MAX_VISIBLE = 4
const DURATION = 8000

// Aviso flotante de llegada por QR. Escucha tanto el evento local del lector
// como la lista qr_llegadas de Firebase, para que el aviso se vea también en
// otra sesión/dispositivo (por ejemplo quien vigila el Dashboard).
export default function ScanToast() {
  const [toasts, setToasts] = useState([])

  const addToast = (data) => {
    const key = data.scanId || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => {
      if (prev.some((t) => t.scanId === key)) return prev
      return [...prev.slice(-(MAX_VISIBLE - 1)), { ...data, scanId: key, id: key, at: data.at || Date.now() }]
    })
  }

  useEffect(() => {
    const onScan = (e) => addToast(e.detail || {})
    window.addEventListener(EVENT, onScan)
    window.__avghShowArrival = addToast

    const r = ref(db, `${DB_ROOT}/qr_llegadas`)
    let known = null
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {}
      const keys = Object.keys(val)
      if (!known) {
        known = new Set(keys)
        return
      }
      const nuevos = keys.filter((k) => !known.has(k))
      known = new Set(keys)
      nuevos.forEach((k) => addToast(val[k] || {}))
    })

    return () => {
      window.removeEventListener(EVENT, onScan)
      delete window.__avghShowArrival
      off(r, 'value', unsub)
    }
  }, [])

  useEffect(() => {
    if (!toasts.length) return undefined
    const timer = setInterval(() => {
      const cutoff = Date.now() - DURATION
      setToasts((prev) => prev.filter((t) => t.at > cutoff))
    }, 1000)
    return () => clearInterval(timer)
  }, [toasts.length])

  const close = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (!toasts.length) return null

  return (
    <div className="scan-toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div className="scan-toast" key={t.id}>
          <FaCircleCheck className="scan-toast-icon" />
          <div className="scan-toast-body">
            <strong>✅ Llegó: {t.nombre || 'Participante'}</strong>
            <span>Cédula: {t.cedula || '—'}</span>
            <span>Empresa: {t.empresa || '—'}</span>
            {t.actividad && <span className="scan-toast-act">{t.actividad}</span>}
          </div>
          <button className="scan-toast-close" onClick={() => close(t.id)} aria-label="Cerrar aviso">
            <FaXmark />
          </button>
        </div>
      ))}
    </div>
  )
}

export function notifyScan(data) {
  const payload = { ...data, scanId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }
  try {
    window.__avghShowArrival?.(payload)
    window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }))
  } catch {
    /* el aviso local es opcional */
  }
  try {
    push(ref(db, `${DB_ROOT}/qr_llegadas`), payload).catch(() => {})
  } catch {
    /* si falla, el aviso local sigue funcionando */
  }
}
