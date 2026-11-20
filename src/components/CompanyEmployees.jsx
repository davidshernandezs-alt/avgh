import { useState, useRef, useEffect } from 'react'
import { FaUserPlus, FaQrcode, FaTrash, FaIdCard, FaBuilding, FaFileExcel, FaBook, FaCheck } from 'react-icons/fa6'
import { ref, onValue, set, push, remove, get } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { useLang } from '../i18n'
import { useActivities, createInscription } from '../data/useData'
import { localize } from '../utils/localized'
import TicketModal from './TicketModal'
import * as XLSX from 'xlsx'

export default function CompanyEmployees({ companyUid, companyName }) {
  const { lang, t } = useLang()
  const { items: actividades } = useActivities()
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({ nombres: '', apellidos: '', dni: '', cargo: '', areaLaboral: '', email: '', actividadId: '' })
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [selectedCourseEmp, setSelectedCourseEmp] = useState(null)
  const [enrollActId, setEnrollActId] = useState('')
  const [busy, setBusy] = useState(false)
  const [enrollBusy, setEnrollBusy] = useState(false)
  const [enrollMsg, setEnrollMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!companyUid) return undefined
    const empRef = ref(db, `${DB_ROOT}/companies/${companyUid}/employees`)
    const unsub = onValue(empRef, (snap) => {
      const val = snap.val() || {}
      const list = Object.entries(val).map(([id, item]) => ({ id, ...item }))
      setEmployees(list)
    })
    return () => unsub()
  }, [companyUid])

  const enrollEmployeeInCourse = async (empData, actId) => {
    if (!actId) return
    const act = actividades.find((a) => a.id === actId)
    if (!act) return
    const fakeUid = `emp_${empData.dni.replace(/\D/g, '') || Date.now()}`
    await createInscription({
      uid: fakeUid,
      actividad: act,
      user: {
        nombres: empData.nombres,
        apellidos: empData.apellidos || '',
        dni: empData.dni,
        email: empData.email || `${empData.dni}@avgh.local`,
        empresa: companyName || ''
      },
      metodoPago: Number(act.precio) > 0 ? 'transfer' : 'gratis',
      estado: 'confirmada',
      tipoAsistente: 'regular'
    })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.nombres || !form.dni) return
    setBusy(true)
    try {
      const empRef = ref(db, `${DB_ROOT}/companies/${companyUid}/employees`)
      const newRef = push(empRef)
        const empEmail = form.email && form.email.includes('@') ? form.email : `${form.dni.replace(/\D/g, '') || Date.now()}@avgh.local`
      const newEmpData = {
        nombres: form.nombres,
        apellidos: form.apellidos || '',
        dni: form.dni,
        cargo: form.cargo || '',
        areaLaboral: form.areaLaboral || '',
        email: empEmail,
        empresa: companyName || '',
        actividadId: form.actividadId || '',
        fechaRegistro: Date.now()
      }
      await set(newRef, newEmpData)

      if (form.actividadId) {
        await enrollEmployeeInCourse(newEmpData, form.actividadId)
      }

      setForm({ nombres: '', apellidos: '', dni: '', cargo: '', areaLaboral: '', email: '', actividadId: '' })
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const handleAssignCourseModal = async (e) => {
    e.preventDefault()
    if (!selectedCourseEmp || !enrollActId) return
    setEnrollBusy(true)
    setEnrollMsg('')
    try {
      await enrollEmployeeInCourse(selectedCourseEmp, enrollActId)
      // Guardar también la última actividad asignada en la plantilla del empleado
      await set(ref(db, `${DB_ROOT}/companies/${companyUid}/employees/${selectedCourseEmp.id}/actividadId`), enrollActId)
      setEnrollMsg('✅ Empleado inscrito exitosamente en el curso.')
      setTimeout(() => {
        setEnrollMsg('')
        setSelectedCourseEmp(null)
      }, 1500)
    } catch {
      setEnrollMsg('Error al inscribir empleado en el curso.')
    } finally {
      setEnrollBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar a este empleado de la plantilla?')) return
    try {
      await remove(ref(db, `${DB_ROOT}/companies/${companyUid}/employees/${id}`))
    } catch {
      /* ignore */
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      { nombres: 'Carlos', apellidos: 'Pérez', dni: 'V-12345678', cargo: 'Gerente', areaLaboral: 'Operaciones', email: 'carlos@empresa.com' },
      { nombres: 'Ana', apellidos: 'González', dni: 'V-87654321', cargo: 'Analista', areaLaboral: 'Administración', email: 'ana@empresa.com' }
    ]
    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados')
    XLSX.writeFile(workbook, 'Plantilla_Empleados_Empresa.xlsx')
  }

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('Procesando archivo Excel...')

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      if (!jsonRows || jsonRows.length === 0) {
        setUploadMsg('El archivo Excel está vacío o no tiene el formato correcto.')
        setUploading(false)
        return
      }

      let count = 0
      const empRef = ref(db, `${DB_ROOT}/companies/${companyUid}/employees`)

      for (const row of jsonRows) {
        const nombres = String(row.nombres || row.Nombre || row.NOMBRES || '').trim()
        const apellidos = String(row.apellidos || row.Apellido || row.APELLIDOS || '').trim()
        const dni = String(row.dni || row.DNI || row.cedula || row.Cedula || row.CEDULA || '').trim()
        const cargo = String(row.cargo || row.Cargo || '').trim()
        const areaLaboral = String(row.areaLaboral || row['Área Laboral'] || row['Area Laboral'] || row.area || row.Area || row.departamento || row.Departamento || '').trim()
        const email = String(row.email || row.Email || row.Correo || '').trim()

        if (nombres && dni) {
          const newRef = push(empRef)
          const empEmail = email && email.includes('@') ? email : `${dni.replace(/\D/g, '') || Date.now()}@avgh.local`
          const empObj = {
            nombres,
            apellidos,
            dni,
            cargo,
            areaLaboral,
            email: empEmail,
            empresa: companyName || '',
            actividadId: form.actividadId || '',
            fechaRegistro: Date.now()
          }
          await set(newRef, empObj)

          if (form.actividadId) {
            await enrollEmployeeInCourse(empObj, form.actividadId)
          }

          count++
        }
      }

      setUploadMsg(`✅ ¡Éxito! Se importaron ${count} empleados a la plantilla.`)
      setTimeout(() => setUploadMsg(''), 4000)
    } catch {
      setUploadMsg('Error al procesar el archivo Excel. Asegúrate de usar la plantilla correcta.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="panel company-employees-panel" style={{ marginTop: '20px' }}>
      <div className="panel-head">
        <FaBuilding />
        <h3>Plantilla de Empleados - {companyName || 'Empresa'}</h3>
      </div>
      <p className="auth-hint">
        Registra el personal de tu empresa. Puedes agregarlos uno a uno o por Excel, e inscribirlos opcionalmente a un curso de forma inmediata o más adelante.
      </p>

      <div className="field-label" style={{ marginBottom: '16px', background: 'var(--bg-muted)', padding: '12px', borderRadius: '8px' }}>
        <span>(Opcional) Asignar Curso / Taller al momento de registrar:</span>
        <select
          className="input"
          value={form.actividadId}
          onChange={(e) => setForm({ ...form, actividadId: e.target.value })}
        >
          <option value="">-- No inscribir por ahora (Solo agregar a la plantilla) --</option>
          {actividades.map((a) => (
            <option key={a.id} value={a.id}>
              {localize(a.titulo, lang)} ({t(`type.${a.tipo}`)})
            </option>
          ))}
        </select>
      </div>

      <div className="btn-row" style={{ marginBottom: '16px' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={downloadTemplate}>
          📥 Descargar Plantilla Excel
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <FaFileExcel /> {uploading ? 'Cargando...' : 'Cargar Empleados desde Excel'}
        </button>
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          ref={fileInputRef}
          className="hidden-input"
          onChange={handleExcelUpload}
        />
      </div>

      {uploadMsg && <p className="form-success" style={{ marginBottom: '14px' }}>{uploadMsg}</p>}

      <form className="form form-pad" onSubmit={handleAdd} style={{ marginBottom: '20px' }}>
        <div className="field-row">
          <label className="field-label">
            <span>Nombres</span>
            <input
              className="input"
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.target.value })}
              required
            />
          </label>
          <label className="field-label">
            <span>Apellidos</span>
            <input
              className="input"
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field-label">
            <span>Cédula / DNI</span>
            <input
              className="input"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              required
            />
          </label>
          <label className="field-label">
            <span>Correo Electrónico</span>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="correo@empleado.com"
            />
          </label>
        </div>

        <div className="field-row" style={{ marginTop: '12px' }}>
          <label className="field-label">
            <span>Cargo</span>
            <input
              className="input"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Área Laboral / Departamento</span>
            <input
              className="input"
              value={form.areaLaboral}
              onChange={(e) => setForm({ ...form, areaLaboral: e.target.value })}
              placeholder="Ej. Operaciones, Ventas, Mantenimiento"
            />
          </label>
        </div>

        <button className="btn btn-primary" disabled={busy}>
          <FaUserPlus /> Agregar Empleado
        </button>
      </form>

      {employees.length === 0 ? (
        <p className="auth-hint">No hay empleados registrados en la plantilla.</p>
      ) : (
        <ul className="list">
          {employees.map((emp) => {
            const assignedAct = actividades.find((a) => a.id === emp.actividadId)
            return (
              <li key={emp.id} className="list-item flex-wrap">
                <div className="list-main">
                  <strong style={{ display: 'block' }}>{emp.nombres} {emp.apellidos}</strong>
                  <span className="list-sub">
                    Cédula: {emp.dni}
                    {emp.cargo ? ` · Cargo: ${emp.cargo}` : ''}
                    {emp.areaLaboral ? ` · Área: ${emp.areaLaboral}` : ''}
                    {assignedAct && ` · Curso: ${localize(assignedAct.titulo, lang)}`}
                  </span>
                </div>
                <div className="profile-insc-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => { setSelectedCourseEmp(emp); setEnrollActId(emp.actividadId || '') }}>
                    <FaBook /> Inscribir en Curso
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelectedEmp(emp)}>
                    <FaQrcode /> Carnet / QR
                  </button>
                  <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(emp.id)}>
                    <FaTrash />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Modal para inscribir empleado en curso existente */}
      {selectedCourseEmp && (
        <div className="qr-modal-backdrop" onClick={() => setSelectedCourseEmp(null)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="admin-detail-head">
              <h3>Inscribir a {selectedCourseEmp.nombres} {selectedCourseEmp.apellidos}</h3>
            </div>
            <form onSubmit={handleAssignCourseModal} style={{ padding: '16px 0 0', textAlign: 'left' }}>
              <label className="field-label" style={{ marginBottom: '16px' }}>
                <span>Selecciona el Curso, Taller o Evento:</span>
                <select
                  className="input"
                  value={enrollActId}
                  onChange={(e) => setEnrollActId(e.target.value)}
                  required
                >
                  <option value="">-- Seleccionar Actividad --</option>
                  {actividades.map((a) => (
                    <option key={a.id} value={a.id}>
                      {localize(a.titulo, lang)} ({t(`type.${a.tipo}`)})
                    </option>
                  ))}
                </select>
              </label>

              {enrollMsg && <p className="form-success" style={{ marginBottom: '12px' }}>{enrollMsg}</p>}

              <div className="btn-row">
                <button type="submit" className="btn btn-primary" disabled={enrollBusy || !enrollActId}>
                  <FaCheck /> Confirmar Inscripción
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setSelectedCourseEmp(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEmp && (
        <TicketModal
          actividad={{ titulo: { es: `Empleado AVGH - ${companyName || 'Empresa'}` } }}
          user={{ nombres: selectedEmp.nombres, apellidos: selectedEmp.apellidos, dni: selectedEmp.dni, empresa: companyName }}
          onClose={() => setSelectedEmp(null)}
        />
      )}
    </div>
  )
}