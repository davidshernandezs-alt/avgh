import { useState } from 'react'
import { ref, update } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { FaXmark, FaUserPen } from 'react-icons/fa6'

const FIELDS = [
  ['nombres', 'Nombres'],
  ['apellidos', 'Apellidos'],
  ['dni', 'Cédula / DNI'],
  ['cedula', 'Cédula (alterno)'],
  ['email', 'Correo electrónico'],
  ['telefono', 'Teléfono'],
  ['telefonoCelular', 'Teléfono celular'],
  ['empresa', 'Empresa'],
  ['nombreEmpresa', 'Nombre de la empresa'],
  ['cargo', 'Cargo'],
  ['rif', 'RIF'],
  ['direccionFiscal', 'Dirección fiscal'],
  ['direccionOficina', 'Dirección de oficina']
]

const TIPOS = [
  ['regular', 'Asistente'],
  ['junta', 'Junta Directiva'],
  ['facilitador', 'Facilitador'],
  ['invitado', 'Invitado'],
  ['exonerado', 'Exonerado']
]

// Permite al admin corregir los datos guardados de un participante/afiliado.
// Actualiza el perfil (users/{uid}) y, si viene de una inscripción, también
// la copia de datos dentro de la inscripción para que el carnet/QR muestre
// la información corregida.
export default function AdminEditPersonModal({ uid, person, inscripcion, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const out = {}
    FIELDS.forEach(([key]) => { out[key] = person?.[key] || '' })
    if (inscripcion) out.tipoAsistente = person?.tipoAsistente || inscripcion?.tipoAsistente || 'regular'
    return out
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const updates = {}
      FIELDS.forEach(([key]) => { updates[`${DB_ROOT}/users/${uid}/${key}`] = form[key] || '' })

      if (inscripcion?.actividadId) {
        const actId = inscripcion.actividadId
        FIELDS.forEach(([key]) => { updates[`${DB_ROOT}/inscripciones/${uid}/${actId}/user/${key}`] = form[key] || '' })
        if (form.tipoAsistente) {
          updates[`${DB_ROOT}/inscripciones/${uid}/${actId}/tipoAsistente`] = form.tipoAsistente
        }
      }

      await update(ref(db, '/'), updates)
      setMsg('Datos guardados correctamente.')
      if (onSaved) onSaved()
    } catch {
      setMsg('No se pudieron guardar los datos. Revisa la conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qr-modal-backdrop admin-review-backdrop" onClick={onClose}>
      <section className="panel admin-detail edit-person-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-detail-head">
          <h3><FaUserPen /> Editar datos de {person?.nombres || 'participante'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <FaXmark />
          </button>
        </div>

        <form className="form form-pad" onSubmit={save}>
          <div className="admin-grid">
            <div className="admin-section">
              <h4>Datos personales</h4>
              {FIELDS.slice(0, 7).map(([key, label]) => (
                <label className="field-label" key={key}>
                  <span>{label}</span>
                  <input
                    className="input"
                    type={key === 'email' ? 'email' : 'text'}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="admin-section">
              <h4>Datos de la empresa / facturación</h4>
              {FIELDS.slice(7).map(([key, label]) => (
                <label className="field-label" key={key}>
                  <span>{label}</span>
                  <input
                    className="input"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
              {inscripcion && (
                <label className="field-label">
                  <span>Tipo de asistente</span>
                  <select className="input" value={form.tipoAsistente} onChange={(e) => set('tipoAsistente', e.target.value)}>
                    {TIPOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              )}
            </div>
          </div>

          {msg && <p className={msg.includes('correctamente') ? 'form-success' : 'form-error'}>{msg}</p>}

          <div className="btn-row" style={{ marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </section>
    </div>
  )
}
