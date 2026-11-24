import { useState, useMemo, useEffect } from 'react'
import {
  FaChartPie,
  FaUsers,
  FaGraduationCap,
  FaCircleCheck,
  FaBuilding,
  FaUser,
  FaChair,
  FaPlus,
  FaUserCheck,
  FaCheck,
  FaXmark,
  FaAward
} from 'react-icons/fa6'
import { ref, update, set, push } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { useLang } from '../i18n'
import { useActivities, useAllUsers, useAllInscripciones, createInscription, useSurveyResponses } from '../data/useData'
import { SURVEY_QUESTIONS } from '../data/survey'
import { localize } from '../utils/localized'
import { CURRENCY } from '../config'
import CertificateModal from '../components/CertificateModal'

export default function AdminDashboard() {
  const { t, lang } = useLang()
  const { items: actividades } = useActivities()
  const { items: users } = useAllUsers()
  const { rows: inscripciones } = useAllInscripciones()
  const { rows: surveyRows, loading: loadingSurvey } = useSurveyResponses()

  // Métricas de la encuesta
  const surveyActividad = useMemo(() => {
    const ids = [...new Set(surveyRows.map((r) => r.actividadId))]
    if (ids.length <= 1) return ids[0] || ''
    return ''
  }, [surveyRows])
  const filteredSurvey = useMemo(
    () => surveyActividad ? surveyRows.filter((r) => r.actividadId === surveyActividad) : surveyRows,
    [surveyRows, surveyActividad]
  )
  const surveyTotals = useMemo(() => {
    const out = {}
    SURVEY_QUESTIONS.forEach((q) => {
      const vals = filteredSurvey.map((r) => r.respuestas?.[q.id]).filter((v) => typeof v === 'number')
      out[q.id] = {
        count: vals.length,
        avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      }
    })
    return out
  }, [filteredSurvey])

  const [selectedActId, setSelectedActId] = useState(actividades[0]?.id || '')
  const [openPanel, setOpenPanel] = useState('') // 'inscripcion' | 'afiliacion' | 'certificados'
  const togglePanel = (name) => setOpenPanel((p) => (p === name ? '' : name))
  const [manualForm, setManualForm] = useState({
    nombres: '',
    apellidos: '',
    dni: '',
    email: '',
    tipoAsistente: 'regular',
    metodoPago: 'cash',
    pagado: true,
    actividadId: actividades[0]?.id || ''
  })
  const [affiliateForm, setAffiliateForm] = useState({
    nombres: '',
    apellidos: '',
    dni: '',
    email: '',
    telefono: '',
    tipoPersona: 'natural',
    tipoAfiliacion: 'individual',
    nombreEmpresa: '',
    rif: ''
  })
  const [msg, setMsg] = useState('')
  const [affMsg, setAffMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [affBusy, setAffBusy] = useState(false)
  const [certActId, setCertActId] = useState(actividades[0]?.id || '')
  const [certRow, setCertRow] = useState(null)

  const effectiveActId = selectedActId || actividades[0]?.id || ''
  const certActIdEff = certActId || effectiveActId
  const certAttendees = useMemo(
    () => inscripciones.filter((i) => i.actividadId === certActIdEff),
    [inscripciones, certActIdEff]
  )

  const certBadge = (tipo) => {
    if (tipo === 'afiliado') return <span className="badge" style={{ background: '#16a34a', color: '#fff' }}>🟢 Afiliado</span>
    if (tipo === 'noafiliado') return <span className="badge" style={{ background: '#6b7280', color: '#fff' }}>⚪ No Afiliado</span>
    if (tipo === 'invitado') return <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>🔵 Invitado especial</span>
    if (tipo === 'junta') return <span className="badge" style={{ background: '#7c3aed', color: '#fff' }}>🟣 Junta Directiva</span>
    if (tipo === 'facilitador') return <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>🟠 Facilitador</span>
    return <span className="badge badge-Confirmada">Regular</span>
  }

  const certCanIssue = (tipo) => (tipo || '') !== 'facilitador'

  useEffect(() => {
    if (actividades.length > 0 && !selectedActId) {
      setSelectedActId(actividades[0].id)
    }
  }, [actividades, selectedActId])

  // Métricas globales
  const totalUsers = users.filter((u) => u.rol !== 'admin').length
  const naturalCount = users.filter((u) => u.rol !== 'admin' && (u.tipoPersona || 'natural') === 'natural').length
  const juridicoCount = users.filter((u) => u.rol !== 'admin' && u.tipoPersona === 'juridico').length
  const totalInscritos = inscripciones.length
  const confirmadosCount = inscripciones.filter((i) => i.estado === 'confirmada' || i.estado === 'confirmed').length
  const activeCoursesCount = actividades.length

  // Aforo para el curso seleccionado
  const courseInscripciones = useMemo(() => {
    if (!effectiveActId) return []
    return inscripciones.filter((i) => i.actividadId === effectiveActId)
  }, [inscripciones, effectiveActId])

  const selectedAct = actividades.find((a) => a.id === effectiveActId)
  const cupoNum = Number(selectedAct?.cupo)
  const maxSeats = cupoNum > 0 ? Math.max(cupoNum, courseInscripciones.length) : Math.max(100, courseInscripciones.length)

  // Generar cuadrícula de sillas basada en cupos e inscripciones
  const seats = useMemo(() => {
    const list = []
    for (let i = 1; i <= maxSeats; i++) {
      const ins = courseInscripciones[i - 1]
      let status = 'free' // gris por defecto
      if (ins && ins.presente === true) {
        status = 'validated' // verde al marcar asistencia o escanear QR
      }
      list.push({ id: i, status, ins })
    }
    return list
  }, [maxSeats, courseInscripciones])

  const stats = useMemo(() => {
    let validated = 0
    let free = 0
    seats.forEach((s) => {
      if (s.status === 'validated') validated++
      else free++
    })
    return { validated, free }
  }, [seats])

  const handleManualEnroll = async (e) => {
    e.preventDefault()
    const targetActId = manualForm.actividadId || selectedActId || actividades[0]?.id
    if (!manualForm.nombres || !manualForm.dni || !targetActId) {
      setMsg(t('home.requiredField'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const act = actividades.find((a) => a.id === targetActId)
      const esGratis = ['exonerado', 'invitado', 'junta', 'facilitador'].includes(manualForm.tipoAsistente)
      const pagado = esGratis || manualForm.pagado
      const fakeUser = {
        nombres: manualForm.nombres,
        apellidos: manualForm.apellidos || '',
        email: manualForm.email || `${manualForm.dni}@avgh.local`,
        dni: manualForm.dni
      }
      const fakeUid = `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`
      const esAfiliado = ['afiliado'].includes(manualForm.tipoAsistente)
      await set(ref(db, `${DB_ROOT}/users/${fakeUid}`), {
        ...fakeUser,
        rol: 'member',
        tipoPersona: 'natural',
        afiliado: esAfiliado,
        tipoAfiliacion: esAfiliado ? 'individual' : '',
        planAfiliacion: esAfiliado ? 'individual' : '',
        afiliadoDesde: esAfiliado ? Date.now() : null,
        fechaRegistro: Date.now()
      })
      await createInscription({
        uid: fakeUid,
        actividad: act,
        user: fakeUser,
        metodoPago: esGratis ? 'gratis' : manualForm.metodoPago,
        estado: pagado ? 'confirmada' : 'pendiente',
        monto: esGratis ? 0 : (pagado ? (Number(act?.precio) || 0) : 0),
        tipoAsistente: manualForm.tipoAsistente,
        validadaFecha: pagado ? Date.now() : null,
        presente: false
      })
      setMsg('✅ Inscripción manual registrada con éxito.')
      setManualForm({ nombres: '', apellidos: '', dni: '', email: '', tipoAsistente: 'regular', metodoPago: 'cash', pagado: true, actividadId: targetActId })
    } catch {
      setMsg(t('admin.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  const handleAffiliate = async (e) => {
    e.preventDefault()
    if (!affiliateForm.dni || !affiliateForm.nombres) {
      setAffMsg(t('home.requiredField'))
      return
    }
    setAffBusy(true)
    setAffMsg('')
    try {
      const newUid = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`
      const userData = {
        nombres: affiliateForm.nombres,
        apellidos: affiliateForm.apellidos || '',
        dni: affiliateForm.dni.trim(),
        email: affiliateForm.email || `${affiliateForm.dni}@avgh.local`,
        telefono: affiliateForm.telefono || '',
        tipoPersona: affiliateForm.tipoPersona,
        tipoAfiliacion: affiliateForm.tipoAfiliacion,
        planAfiliacion: affiliateForm.tipoAfiliacion,
        nombreEmpresa: affiliateForm.nombreEmpresa || '',
        rif: affiliateForm.rif || '',
        afiliado: true,
        afiliadoDesde: Date.now(),
        onboardingCompleted: true,
        rol: 'member',
        fechaRegistro: Date.now()
      }
      await set(ref(db, `${DB_ROOT}/users/${newUid}`), userData)
      setAffMsg('✅ Afiliado registrado con éxito en el sistema.')
      setAffiliateForm({
        nombres: '',
        apellidos: '',
        dni: '',
        email: '',
        telefono: '',
        tipoPersona: 'natural',
        tipoAfiliacion: 'individual',
        nombreEmpresa: '',
        rif: ''
      })
    } catch {
      setAffMsg(t('admin.errorSave'))
    } finally {
      setAffBusy(false)
    }
  }

  const toggleAttendance = async (insc) => {
    if (!insc) return
    try {
      const newPresente = !insc.presente
      await update(ref(db, `${DB_ROOT}/inscripciones/${insc.uid}/${insc.actividadId}`), {
        presente: newPresente
      })
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {/* Métricas Generales */}
      <section className="panel">
        <div className="panel-head">
          <FaChartPie />
          <h3>{t('admin.dashboardMetrics') || 'Dashboard General de Métricas'}</h3>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <FaUsers className="metric-icon text-blue" />
            <div>
              <span>{t('admin.metric.users') || 'Total Afiliados'}</span>
              <strong>{totalUsers}</strong>
              <small>{naturalCount} Naturales · {juridicoCount} Jurídicos</small>
            </div>
          </div>
          <div className="metric-card">
            <FaGraduationCap className="metric-icon text-gold" />
            <div>
              <span>{t('admin.metric.courses') || 'Cursos y Talleres'}</span>
              <strong>{activeCoursesCount}</strong>
            </div>
          </div>
          <div className="metric-card">
            <FaCircleCheck className="metric-icon text-success" />
            <div>
              <span>{t('admin.metric.inscriptions') || 'Inscripciones Totales'}</span>
              <strong>{totalInscritos}</strong>
              <small>{confirmadosCount} Pagadas y Confirmadas</small>
            </div>
          </div>
        </div>
      </section>

      {/* Control Visual de Aforo / Sillas por Curso */}
      <section className="panel">
        <div className="panel-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaChair />
            <h3>AFORO</h3>
          </div>
          <div className="btn-row">
            <button className={`btn btn-sm ${openPanel === 'asistencia' ? 'btn-primary' : 'btn-outline'}`} onClick={() => togglePanel('asistencia')}>
              <FaCircleCheck /> Listado de Asistencia
            </button>
            <button className={`btn btn-sm ${openPanel === 'inscripcion' ? 'btn-primary' : 'btn-outline'}`} onClick={() => togglePanel('inscripcion')}>
              <FaPlus /> Inscripción
            </button>
            <button className={`btn btn-sm ${openPanel === 'afiliacion' ? 'btn-primary' : 'btn-outline'}`} onClick={() => togglePanel('afiliacion')}>
              <FaUserCheck /> Afiliación Manual
            </button>
            <button className={`btn btn-sm ${openPanel === 'certificados' ? 'btn-primary' : 'btn-outline'}`} onClick={() => togglePanel('certificados')}>
              <FaAward /> Generador de Certificados
            </button>
          </div>
        </div>

        <div className="field-label" style={{ maxWidth: '400px', marginBottom: '16px' }}>
          <span>SELECCIONAR CURSO, TALLER O EVENTO</span>
          <select
            className="input"
            value={effectiveActId}
            onChange={(e) => setSelectedActId(e.target.value)}
          >
            {actividades.map((a) => (
              <option key={a.id} value={a.id}>
                {localize(a.titulo, lang)} ({t(`type.${a.tipo}`)}) · Cupo: {a.cupo || 100}
              </option>
            ))}
          </select>
        </div>

        <div className="aforo-layout">
          <div className="aforo-stats">
            <div className="aforo-stat-item is-validated">
              <span className="dot" />
              <div>
                <strong>{stats.validated}</strong>
                <small>Asistentes Presentes (Verde)</small>
              </div>
            </div>
            <div className="aforo-stat-item is-free">
              <span className="dot" />
              <div>
                <strong>{stats.free}</strong>
                <small>Sillas Libres / Por Llegar (Gris)</small>
              </div>
            </div>
            <div className="aforo-stat-item is-pending">
              <span className="dot" />
              <div>
                <strong>{cupoNum > 0 ? Math.max(0, cupoNum - courseInscripciones.filter((i) => i.listaEspera !== true && i.estado !== 'rechazada').length) : '∞'}</strong>
                <small>Cupos disponibles</small>
              </div>
            </div>
            <div className="aforo-stat-item is-guest">
              <span className="dot" />
              <div>
                <strong>{courseInscripciones.filter((i) => i.listaEspera === true && i.estado !== 'rechazada').length}</strong>
                <small>En lista de espera</small>
              </div>
            </div>
          </div>

          <div className="seats-grid">
            {seats.map((s) => (
              <div
                key={s.id}
                className={`seat-box seat-${s.status}`}
                title={s.ins ? `${s.ins.user?.nombres || 'Asistente'} ${s.ins.user?.apellidos || ''} (${s.ins.tipoAsistente || 'regular'})` : 'Silla libre'}
              >
                <FaChair />
              </div>
            ))}
          </div>

          {/* Listado rápido de asistencia para marcar con un click */}
          {openPanel === 'asistencia' && (
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Listado de Asistencia del Evento (Marcar / Desmarcar Asistencia)</h4>
            {courseInscripciones.length === 0 ? (
              <p className="auth-hint">No hay inscritos en este evento aún.</p>
            ) : (
              <ul className="list">
                {courseInscripciones.map((ins) => {
                  const isPresent = ins.presente === true
                  return (
                    <li key={`${ins.uid}-${ins.actividadId}`} className="list-item flex-wrap">
                      <div className="list-main">
                        <strong>{ins.user?.nombres || 'Participante'} {ins.user?.apellidos || ''}</strong>
                        <span className="list-sub">
                          Cédula: {ins.user?.dni || '—'} · Tipo: {ins.tipoAsistente || 'regular'} · Pago: {ins.estado}
                        </span>
                      </div>
                      <div className="profile-insc-actions">
                        {ins.listaEspera === true && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              await update(ref(db, `${DB_ROOT}/inscripciones/${ins.uid}/${ins.actividadId}`), {
                                listaEspera: false,
                                estado: 'confirmada'
                              })
                            }}
                          >
                            <FaCheck /> Confirmar (pasa a lista)
                          </button>
                        )}
                        <span className={`badge badge-${isPresent ? 'Confirmada' : 'pendiente'}`}>
                          {ins.listaEspera === true ? '📋 Lista de espera' : isPresent ? '✅ Presente (En Sala)' : '⏳ Pendiente de Llegada'}
                        </span>
                        <button
                          type="button"
                          className={`btn btn-sm ${isPresent ? 'btn-outline' : 'btn-primary'}`}
                          onClick={() => toggleAttendance(ins)}
                        >
                          {isPresent ? <><FaXmark /> Marcar Ausente</> : <><FaCheck /> Marcar Asistencia</>}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          )}
        </div>
      </section>

      {/* Inscripción Manual / Mismo Día */}
      {openPanel === 'inscripcion' && (
      <section className="panel">
        <div className="panel-head">
          <FaPlus />
          <h3>Inscripción</h3>
        </div>

        <form className="form form-pad" onSubmit={handleManualEnroll}>
          <div className="field-label">
            <span>Inscripción</span>
            <select
              className="input"
              value={manualForm.actividadId}
              onChange={(e) => setManualForm({ ...manualForm, actividadId: e.target.value })}
              required
            >
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>
                  {localize(a.titulo, lang)}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <label className="field-label">
              <span>{t('home.firstName')}</span>
              <input
                className="input"
                value={manualForm.nombres}
                onChange={(e) => setManualForm({ ...manualForm, nombres: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              <span>{t('home.lastName')}</span>
              <input
                className="input"
                value={manualForm.apellidos}
                onChange={(e) => setManualForm({ ...manualForm, apellidos: e.target.value })}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field-label">
              <span>{t('profile.dni')}</span>
              <input
                className="input"
                value={manualForm.dni}
                onChange={(e) => setManualForm({ ...manualForm, dni: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              <span>{t('home.email')}</span>
              <input
                type="email"
                className="input"
                value={manualForm.email}
                onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
              />
            </label>
          </div>

          <label className="field-label">
            <span>{t('admin.attendeeType') || 'Tipo de Asistente'}</span>
            <select
              className="input"
              value={manualForm.tipoAsistente}
              onChange={(e) => setManualForm({ ...manualForm, tipoAsistente: e.target.value })}
            >
              <option value="regular">Regular / Pagado</option>
              <option value="afiliado">Afiliado</option>
              <option value="noafiliado">No Afiliado</option>
              <option value="invitado">Invitado (Azul)</option>
              <option value="junta">Junta Directiva</option>
              <option value="facilitador">Facilitador</option>
              <option value="exonerado">Exonerado / Apartado (Naranja)</option>
            </select>
          </label>

          <div className="field-row">
            <label className="field-label">
              <span>Método de pago</span>
              <select
                className="input"
                value={manualForm.metodoPago}
                onChange={(e) => setManualForm({ ...manualForm, metodoPago: e.target.value })}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="mobile">Pago móvil</option>
                <option value="binance">Binance Pay</option>
                <option value="card">Tarjeta</option>
              </select>
            </label>
            <label className="field-label">
              <span>¿Está pagado?</span>
              <select
                className="input"
                value={manualForm.pagado ? 'si' : 'no'}
                onChange={(e) => setManualForm({ ...manualForm, pagado: e.target.value === 'si' })}
              >
                <option value="si">Sí, pagado</option>
                <option value="no">No pagado (pendiente)</option>
              </select>
            </label>
          </div>
          <p className="auth-hint">
            El estado se refleja en la factura: pagado → <strong>completada</strong>; no pagado → <strong>pendiente</strong>.
            Los tipos exonerado, invitado, junta y facilitador son siempre gratuitos.
          </p>

          {msg && <p className="form-success">{msg}</p>}

          <div className="btn-row" style={{ marginTop: '14px' }}>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? '...' : <><FaPlus /> Inscribir Participante</>}
            </button>
          </div>
        </form>
      </section>
      )}

      {/* Módulo de Afiliación Manual por el Administrador */}
      {openPanel === 'afiliacion' && (
      <section className="panel">
        <div className="panel-head">
          <FaUserCheck />
          <h3>Afiliación Manual de Miembro (Admin)</h3>
        </div>
        <p className="auth-hint">Registra y otorga estatus de afiliado activo directamente a un nuevo miembro desde el panel.</p>

        <form className="form form-pad" onSubmit={handleAffiliate}>
          <div className="field-row">
            <label className="field-label">
              <span>Tipo de Persona</span>
              <select
                className="input"
                value={affiliateForm.tipoPersona}
                onChange={(e) => setAffiliateForm({ ...affiliateForm, tipoPersona: e.target.value })}
              >
                <option value="natural">Natural</option>
                <option value="juridico">Jurídico / Empresa</option>
              </select>
            </label>
            <label className="field-label">
              <span>Plan de afiliación</span>
              <select
                className="input"
                value={affiliateForm.tipoAfiliacion}
                onChange={(e) => setAffiliateForm({ ...affiliateForm, tipoAfiliacion: e.target.value })}
              >
                <option value="individual">Individual</option>
                <option value="corporativo">Corporativo</option>
              </select>
            </label>
          </div>

          {affiliateForm.tipoPersona === 'juridico' && (
            <div className="field-row">
              <label className="field-label">
                <span>Nombre de la Empresa</span>
                <input
                  className="input"
                  value={affiliateForm.nombreEmpresa}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, nombreEmpresa: e.target.value })}
                  required
                />
              </label>
              <label className="field-label">
                <span>RIF</span>
                <input
                  className="input"
                  value={affiliateForm.rif}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, rif: e.target.value })}
                  required
                />
              </label>
            </div>
          )}

          <div className="field-row">
            <label className="field-label">
              <span>{t('home.firstName')}</span>
              <input
                className="input"
                value={affiliateForm.nombres}
                onChange={(e) => setAffiliateForm({ ...affiliateForm, nombres: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              <span>{t('home.lastName')}</span>
              <input
                className="input"
                value={affiliateForm.apellidos}
                onChange={(e) => setAffiliateForm({ ...affiliateForm, apellidos: e.target.value })}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field-label">
              <span>{t('profile.dni')}</span>
              <input
                className="input"
                value={affiliateForm.dni}
                onChange={(e) => setAffiliateForm({ ...affiliateForm, dni: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              <span>Teléfono</span>
              <input
                className="input"
                value={affiliateForm.telefono}
                onChange={(e) => setAffiliateForm({ ...affiliateForm, telefono: e.target.value })}
              />
            </label>
          </div>

          <label className="field-label">
            <span>{t('home.email')}</span>
            <input
              type="email"
              className="input"
              value={affiliateForm.email}
              onChange={(e) => setAffiliateForm({ ...affiliateForm, email: e.target.value })}
            />
          </label>

          {affMsg && <p className="form-success">{affMsg}</p>}

          <div className="btn-row" style={{ marginTop: '14px' }}>
            <button className="btn btn-primary" disabled={affBusy}>
              {affBusy ? '...' : <><FaUserCheck /> Registrar Afiliado</>}
            </button>
          </div>
        </form>
      </section>
      )}

      {/* Generador de Certificados */}
      {openPanel === 'certificados' && (
      <section className="panel">
        <div className="panel-head">
          <FaAward />
          <h3>Generador de Certificados</h3>
        </div>
        <p className="auth-hint">Genera certificados para los asistentes que confirmaron su asistencia.</p>

        <div className="field-row" style={{ marginBottom: '14px' }}>
          <label className="field-label">
            <span>Curso / Evento</span>
            <select className="input" value={certActIdEff} onChange={(e) => setCertActId(e.target.value)}>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>{localize(a.titulo, lang)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Cédula</th>
                <th>Tipo de Asistente</th>
                <th>Asistencia</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {certAttendees.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="auth-hint">Sin asistentes registrados para este curso / evento.</p>
                  </td>
                </tr>
              ) : (
                certAttendees.map((r) => (
                  <tr key={`${r.uid}-${r.actividadId}`}>
                    <td>
                      <div className="admin-student">
                        <strong>{r.user?.nombres || ''} {r.user?.apellidos || ''}</strong>
                        <small>{r.user?.email}</small>
                      </div>
                    </td>
                    <td>{r.user?.dni || r.user?.cedula || '—'}</td>
                    <td>{certBadge(r.tipoAsistente)}</td>
                    <td>{r.presente === true ? '✅ Presente' : '⏳ Por llegar'}</td>
                    <td>
                      {r.presente === true && certCanIssue(r.tipoAsistente) ? (
                        <button className="btn btn-outline btn-sm" onClick={() => setCertRow(r)}>
                          <FaAward /> Generar certificado
                        </button>
                      ) : (
                        <span className="auth-hint">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Encuestas de satisfacción */}
      <section className="panel">
        <div className="panel-head">
          <FaAward />
          <h3>Encuestas de satisfacción</h3>
        </div>
        {loadingSurvey ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : filteredSurvey.length === 0 ? (
          <div className="panel-empty">
            <p>Aún no hay respuestas de encuestas.</p>
          </div>
        ) : (
          <>
            <p className="auth-hint">
              {filteredSurvey.length} respuesta(s) · Promedio general:{' '}
              <strong>
                {(() => {
                  const all = SURVEY_QUESTIONS.map((q) => surveyTotals[q.id]).filter((x) => x.count)
                  return all.length ? (all.reduce((a, b) => a + b.avg, 0) / all.length).toFixed(2) : '—'
                })()} / 4
              </strong>
            </p>
            <div className="survey-metrics">
              {SURVEY_QUESTIONS.map((q) => {
                const m = surveyTotals[q.id]
                const pct = m.count ? Math.round((m.avg / 4) * 100) : 0
                return (
                  <div className="survey-metric" key={q.id}>
                    <div className="survey-metric-head">
                      <span>{q.text}</span>
                      <strong>{m.count ? `${m.avg.toFixed(2)} / 4` : '—'}</strong>
                    </div>
                    <div className="survey-metric-bar">
                      <div className="survey-metric-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <small>{m.count} respuesta(s)</small>
                  </div>
                )
              })}
            </div>

            <h4 style={{ marginTop: '18px' }}>Comentarios y sugerencias</h4>
            <ul className="list">
              {filteredSurvey.filter((r) => r.comentarios && Object.values(r.comentarios).some((c) => c && c.trim())).map((r) => (
                <li key={`${r.actividadId}-${r.uid}`} className="list-item">
                  <div className="list-main">
                    <strong>{r.user?.nombres} {r.user?.apellidos}</strong>
                    {Object.entries(r.comentarios).filter(([, c]) => c && c.trim()).map(([k, c]) => (
                      <span className="list-sub" key={k}>{c}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {certRow && (
        <CertificateModal
          user={certRow.user}
          insc={certRow}
          act={actividades.find((a) => a.id === certRow.actividadId)}
          mode="admin"
          onClose={() => setCertRow(null)}
        />
      )}
    </>
  )
}