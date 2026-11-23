import { useState, useEffect } from 'react'
import { FaCircleQuestion, FaPaperPlane, FaCheck } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { usePreguntas, addPregunta } from '../data/useData'
import { localize } from '../utils/localized'

export default function UserQuestions({ actividades, inscripciones }) {
  const { t, lang } = useLang()
  const asistidas = inscripciones.filter((i) => i.presente === true)
  const [actividadId, setActividadId] = useState('')
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Las inscripciones llegan de Firebase después del mount: fijamos la primera
  // actividad presenciada cuando estén disponibles.
  useEffect(() => {
    if (!actividadId && asistidas.length > 0) {
      setActividadId(asistidas[0].actividadId)
    }
  }, [asistidas, actividadId])
  const { rows, loading } = usePreguntas(actividadId)

  const activa = asistidas.find((i) => i.actividadId === actividadId)
  const titulo = localize(actividades.find((a) => a.id === actividadId)?.titulo, lang) || activa?.actividadId || ''
  const mias = rows.filter((p) => p.uid === activa?.uid || p.user?.email)

  const enviar = async (e) => {
    e.preventDefault()
    const idFinal = actividadId || asistidas[0]?.actividadId || ''
    if (!texto.trim() || !idFinal) {
      setMsg('Selecciona una actividad y escribe tu pregunta.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await addPregunta({
        actividadId: idFinal,
        texto,
        uid: activa?.uid,
        user: activa?.user
      })
      setTexto('')
      setMsg('¡Pregunta enviada! El facilitador la verá en pantalla.')
    } catch (err) {
      console.error('Error al enviar pregunta:', err)
      setMsg(`No se pudo enviar la pregunta. ${err?.message || 'Intenta de nuevo.'}`)
    } finally {
      setBusy(false)
    }
  }

  if (asistidas.length === 0) return null

  return (
    <section className="panel">
      <div className="panel-head">
        <FaCircleQuestion />
        <h3>Preguntas que quiero hacer</h3>
      </div>
      <p className="auth-hint">
        Escribe tus preguntas durante el evento. El facilitador las verá en vivo y podrá mostrarlas en pantalla para contestarlas.
      </p>

      <label className="field-label">
        <span>Actividad</span>
        <select className="input" value={actividadId} onChange={(e) => { setActividadId(e.target.value); setMsg('') }}>
          {asistidas.map((i) => (
            <option key={i.actividadId} value={i.actividadId}>
              {localize(actividades.find((a) => a.id === i.actividadId)?.titulo, lang) || i.actividadId}
            </option>
          ))}
        </select>
      </label>

      <form className="question-form" onSubmit={enviar}>
        <textarea
          className="input textarea"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe aquí tu pregunta..."
          required
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          <FaPaperPlane /> {busy ? 'Enviando...' : 'Enviar pregunta'}
        </button>
      </form>
      {msg && <p className="form-success">{msg}</p>}

      {loading ? (
        <div className="loading">{t('cat.loading')}</div>
      ) : rows.length === 0 ? (
        <p className="auth-hint">Aún no hay preguntas en esta actividad.</p>
      ) : (
        <ul className="list qa-list">
          {rows.map((p) => (
            <li key={p.id} className={`list-item ${p.respondida ? 'qa-answered' : ''}`}>
              <div className="list-main">
                <span>{p.texto}</span>
                <span className="list-sub">
                  {p.user?.nombres} {p.user?.apellidos} · {new Date(p.fecha).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {p.respondida && <span className="badge badge-confirmada"><FaCheck /> Contestada</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
