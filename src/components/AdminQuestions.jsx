import { useState } from 'react'
import { FaCircleQuestion, FaArrowLeft, FaCheck, FaTrash, FaDisplay } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useActivities, usePreguntas, setPreguntaRespondida, deletePregunta } from '../data/useData'
import { localize } from '../utils/localized'

export default function AdminQuestions() {
  const { t, lang } = useLang()
  const { items: actividades } = useActivities()
  const [actividadId, setActividadId] = useState('')
  const [destacada, setDestacada] = useState(null)
  const effectiveId = actividadId || actividades[0]?.id || ''
  const titulo = localize(actividades.find((a) => a.id === effectiveId)?.titulo, lang) || ''
  const { rows: preguntas, loading } = usePreguntas(effectiveId)

  if (destacada) {
    return (
      <div className="qa-stage">
        <div className="qa-stage-top">
          <button className="btn btn-outline" onClick={() => setDestacada(null)}>
            <FaArrowLeft /> Volver a la lista
          </button>
          <span className="qa-stage-event">{titulo}</span>
        </div>
        <div className="qa-stage-card">
          <span className="qa-stage-label">PREGUNTA</span>
          <h2>{destacada.texto}</h2>
          <p className="qa-stage-author">
            {destacada.user?.nombres} {destacada.user?.apellidos}
          </p>
        </div>
        <div className="qa-stage-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={async () => {
              await setPreguntaRespondida(effectiveId, destacada.id, !destacada.respondida)
              setDestacada({ ...destacada, respondida: !destacada.respondida })
            }}
          >
            <FaCheck /> {destacada.respondida ? 'Marcar como pendiente' : 'Marcar como contestada'}
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => setDestacada(null)}>
            <FaArrowLeft /> Seleccionar otra pregunta
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <FaCircleQuestion />
        <h3>Preguntas en vivo</h3>
      </div>
      <p className="auth-hint">
        Selecciona el evento. Las preguntas llegan en orden. Haz clic en una para ponerla en pantalla y contestarla en vivo.
      </p>

      <label className="field-label">
        <span>Evento</span>
        <select className="input" value={effectiveId} onChange={(e) => setActividadId(e.target.value)}>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>{localize(a.titulo, lang)}</option>
          ))}
        </select>
      </label>

      {loading ? (
        <div className="loading">{t('cat.loading')}</div>
      ) : preguntas.length === 0 ? (
        <div className="panel-empty"><p>Aún no hay preguntas para este evento.</p></div>
      ) : (
        <ul className="list qa-list">
          {preguntas.map((p, idx) => (
            <li key={p.id} className={`list-item ${p.respondida ? 'qa-answered' : ''}`}>
              <div className="list-main">
                <strong>#{idx + 1}</strong>
                <span>{p.texto}</span>
                <span className="list-sub">
                  {p.user?.nombres} {p.user?.apellidos} · {new Date(p.fecha).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  {p.respondida ? ' · Contestada' : ''}
                </span>
              </div>
              <div className="qa-actions">
                <button className="btn btn-primary btn-sm" onClick={() => setDestacada(p)} title="Poner en pantalla">
                  <FaDisplay /> Poner en pantalla
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setPreguntaRespondida(effectiveId, p.id, !p.respondida)}>
                  <FaCheck /> {p.respondida ? 'Pendiente' : 'Contestada'}
                </button>
                <button className="btn btn-danger-outline btn-sm" onClick={() => deletePregunta(effectiveId, p.id)}>
                  <FaTrash />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
