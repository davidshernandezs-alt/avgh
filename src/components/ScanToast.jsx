import { useEffect, useState } from 'react'
import { FaCircleCheck, FaXmark } from 'react-icons/fa6'

const EVENT = 'avgh-qr-scan'
const MAX_VISIBLE = 4
const DURATION = 8000

// Aviso flotante que muestra quién acaba de llegar al escanear su QR.
// Escucha el evento global que dispara el validador de asistencia.
export default function ScanToast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onScan = (e) => {
      const data = e.detail || {}
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { ...data, id }])
    }
    window.addEventListener(EVENT, onScan)
    return () => window.removeEventListener(EVENT, onScan)
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
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...data, at: Date.now() } }))
  } catch {
    /* el aviso es informativo */
  }
}
