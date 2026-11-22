import { useState } from 'react'
import { FaXmark, FaCircleCheck } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { submitSurvey } from '../data/useData'
import { SURVEY_QUESTIONS, SURVEY_OPEN_QUESTIONS, surveyIntro } from '../data/survey'
import { localize } from '../utils/localized'

export default function SurveyModal({ user, profile, insc, act, onDone, onClose }) {
  const { t, lang } = useLang()
  const titulo = localize(act?.titulo, lang) || insc?.actividadTitulo || ''
  const [respuestas, setRespuestas] = useState({})
  const [comentarios, setComentarios] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setRespuesta = (id, value) => {
    setRespuestas((p) => ({ ...p, [id]: Number(value) }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const faltan = SURVEY_QUESTIONS.filter((q) => !respuestas[q.id])
    if (faltan.length) {
      setError(`Responde todas las preguntas (faltan ${faltan.length}).`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitSurvey({
        uid: user?.uid,
        actividadId: insc?.actividadId,
        actividadTitulo: titulo,
        respuestas,
        comentarios,
        user: profile || user
      })
      onDone?.()
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la encuesta. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal survey-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-detail-head no-print">
          <h3>Encuesta de satisfacción</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar"><FaXmark /></button>
        </div>
        <form className="survey-form" onSubmit={handleSubmit}>
          <div className="survey-intro">
            <p>{surveyIntro}</p>
            {titulo && <p className="survey-event"><strong>Actividad:</strong> {titulo}</p>}
            <p className="auth-hint">Comparte tu experiencia. Al responder la encuesta podrás ver y descargar el certificado de la actividad.</p>
          </div>

          {SURVEY_QUESTIONS.map((q, idx) => (
            <div className="survey-question" key={q.id}>
              {q.section && q.section !== SURVEY_QUESTIONS[idx - 1]?.section && (
                <h4 className="survey-section">{q.section}</h4>
              )}
              <p className="survey-qtext"><span>{idx + 1}.</span> {q.text}</p>
              <div className="survey-options">
                {q.options.map((opt, i) => (
                  <label key={i} className={`survey-option ${respuestas[q.id] === i + 1 ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={q.id}
                      value={i + 1}
                      checked={respuestas[q.id] === i + 1}
                      onChange={(e) => setRespuesta(q.id, e.target.value)}
                      required
                    />
                    <span className="survey-option-num">{i + 1}</span>
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {SURVEY_OPEN_QUESTIONS.map((q) => (
            <div className="survey-question" key={q.id}>
              <p className="survey-qtext">{q.text}</p>
              <textarea
                className="input textarea"
                rows={3}
                value={comentarios[q.id] || ''}
                onChange={(e) => setComentarios((p) => ({ ...p, [q.id]: e.target.value }))}
                placeholder="Escribe tu respuesta (opcional)"
              />
            </div>
          ))}

          {error && <p className="form-error">{error}</p>}

          <div className="survey-actions no-print">
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              <FaCircleCheck /> {busy ? 'Guardando...' : 'Enviar encuesta y ver mi certificado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
