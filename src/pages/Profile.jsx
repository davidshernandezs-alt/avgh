import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  FaUserPen,
  FaCheck,
  FaXmark,
  FaArrowLeft,
  FaFileInvoice,
  FaGraduationCap,
  FaClockRotateLeft,
  FaFileArrowUp,
  FaFilePdf,
  FaImage,
  FaAward,
  FaLock
} from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { useMyInscriptions, useMyFacturas, useActivities, useUserCertificates, uploadComprobante } from '../data/useData'
import SurveyModal from '../components/SurveyModal'
import { formatDate } from '../components/ActivityCard'
import { CURRENCY } from '../config'
import { fileToStorable } from '../utils/files'
import TicketModal from '../components/TicketModal'
import CertificateModal from '../components/CertificateModal'
import CompanyEmployees from '../components/CompanyEmployees'

const paymentLabels = {
  transfer: 'insc.payment.transfer',
  mobile: 'insc.payment.mobile',
  cash: 'insc.payment.cash',
  card: 'insc.payment.card'
}

function ReceiptUpload({ factura, uid }) {
  const { t } = useLang()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const has = !!factura?.comprobante

  const handle = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMsg('')
    try {
      const stored = await fileToStorable(file, 1000)
      await uploadComprobante({
        uid,
        facturaId: factura.id,
        dataUrl: stored.dataUrl,
        nombre: stored.name,
        tipo: stored.type
      })
      setMsg(t('profile.receiptSaved'))
    } catch (err) {
      setMsg(
        err.message === 'too-large' ? t('profile.receiptTooLarge') : t('profile.receiptBadType')
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const isPdf = factura?.comprobante?.startsWith('data:application/pdf')

  return (
    <div className={`receipt-box ${has ? 'is-filled' : ''}`}>
      <div className="receipt-head">
        {has ? (
          <>
            {isPdf ? <FaFilePdf className="receipt-icon" /> : <FaImage className="receipt-icon" />}
            <span className="receipt-label">
              {t('profile.receiptUploaded')}: {factura.comprobanteNombre || t('profile.receipt')}
            </span>
          </>
        ) : (
          <span className="receipt-label">{t('profile.receipt')}</span>
        )}
      </div>

      {has && isPdf && (
        <a className="btn btn-outline btn-sm" href={factura.comprobante} target="_blank" rel="noopener noreferrer">
          <FaFilePdf /> {t('profile.openPdf')}
        </a>
      )}
      {has && !isPdf && (
        <a href={factura.comprobante} target="_blank" rel="noopener noreferrer" className="receipt-thumb-link">
          <img src={factura.comprobante} alt={t('profile.receipt')} className="receipt-thumb" />
        </a>
      )}
      {!has && <p className="receipt-empty">{t('profile.receiptEmpty')}</p>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden-input" id={`rec-${factura.id}`} onChange={handle} />
      <label htmlFor={`rec-${factura.id}`} className="btn btn-ghost btn-sm">
        <FaFileArrowUp /> {busy ? t('profile.uploading') : has ? t('profile.replaceReceipt') : t('profile.uploadReceipt')}
      </label>
      <p className="receipt-hint">{t('profile.receiptHint')}</p>
      {msg && <p className="form-success receipt-msg">{msg}</p>}
    </div>
  )
}

export default function Profile() {
  const { user, profile, loading, updateProfileData, changePassword } = useAuth()
  const { lang, t } = useLang()
  const { items: inscripciones, loading: loadingInsc } = useMyInscriptions(user?.uid)
  const { items: facturas, loading: loadingFact } = useMyFacturas(user?.uid)
  const { items: actividades, loading: loadingAct } = useActivities()
  const { items: certificates, loading: loadingCerts } = useUserCertificates(user?.uid)

  // Permitir que el admin vea su propio perfil sin redirigir al panel
  // if (profile?.rol === 'admin') return <Navigate to="/admin/panel" replace />

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [showQr, setShowQr] = useState(null)
  const [showCert, setShowCert] = useState(null)
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' })
  const [passMsg, setPassMsg] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [surveyBusy, setSurveyBusy] = useState(null)
  const [showSurvey, setShowSurvey] = useState(null)

  const surveyDone = (actividadId) =>
    !!inscripciones.find((i) => i.actividadId === actividadId)?.encuestaCompletada

  const handleSurveyDone = (actividadId) => setShowSurvey(actividadId)

  // Certificados: solo se muestran si el admin los emitió Y el usuario ya
  // respondió la encuesta de satisfacción de esa actividad.
  const certificadosVisibles = certificates.filter((c) => surveyDone(c.actividadId))

  const removePhoto = async () => {
    setBusy(true)
    try {
      await updateProfileData({ foto: '' })
      setForm((f) => ({ ...f, foto: '' }))
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPassMsg('')
    if (passForm.next !== passForm.confirm) {
      setPassMsg('Las contraseñas nuevas no coinciden.')
      return
    }
    if (passForm.next.length < 6) {
      setPassMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setPassBusy(true)
    try {
      await changePassword(passForm.current, passForm.next)
      setPassForm({ current: '', next: '', confirm: '' })
      setPassMsg('Contraseña actualizada correctamente.')
    } catch (err) {
      setPassMsg(
        err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
          ? 'La contraseña actual es incorrecta.'
          : 'No se pudo cambiar la contraseña. Intenta de nuevo.'
      )
    } finally {
      setPassBusy(false)
    }
  }

  // Permitir que el admin vea su propio perfil sin redirigir al panel
  // if (profile?.rol === 'admin') return <Navigate to="/admin/panel" replace />

  const startEdit = () => {
    setForm({
      nombres: profile?.nombres || '',
      apellidos: profile?.apellidos || '',
      telefono: profile?.telefono || '',
      dni: profile?.dni || '',
      email: profile?.email || user?.email || '',
      edad: profile?.edad || '',
      sexo: profile?.sexo || '',
      foto: profile?.foto || '',
      rif: profile?.rif || '',
      cedula: profile?.cedula || '',
      nombreEmpresa: profile?.nombreEmpresa || '',
      telefonoCelular: profile?.telefonoCelular || '',
      telefonoEmpresa: profile?.telefonoEmpresa || '',
      cargo: profile?.cargo || '',
      direccionFiscal: profile?.direccionFiscal || '',
      direccionOficina: profile?.direccionOficina || '',
      contactoFacturaNombre: profile?.contactoFacturaNombre || '',
      contactoFacturaEmail: profile?.contactoFacturaEmail || '',
      responsableNombre: profile?.responsableNombre || '',
      responsableTelefono: profile?.responsableTelefono || '',
      comoSeEntero: profile?.comoSeEntero || ''
    })
    setSaved(false)
    setEditing(true)
  }

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReading(true)
    try {
      const stored = await fileToStorable(file, 500)
      setForm((f) => ({ ...f, foto: stored.dataUrl }))
    } catch {
      /* tipo no permitido: se ignora */
    } finally {
      setReading(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    await updateProfileData(form)
    setBusy(false)
    setSaved(true)
    setEditing(false)
  }

  const actById = {}
  actividades.forEach((a) => {
    actById[a.id] = a
  })

  const actTitle = (id) => {
    const a = actById[id]
    if (!a) return ''
    return a.titulo && typeof a.titulo === 'object' ? (a.titulo[lang] || a.titulo.es) : a.titulo
  }

  if (loading) return <div className="page"><div className="loading">{t('cat.loading')}</div></div>

  const fullName = profile ? `${profile.nombres || ''} ${profile.apellidos || ''}`.trim() : ''

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/" className="btn-icon" aria-label="Volver">
          <FaArrowLeft />
        </Link>
        <div className="page-head-text">
          <h1>{t('profile.title')}</h1>
        </div>
      </div>

      {/* Datos personales */}
      <section className="profile-card">
        <div className="profile-banner" />
        <div className="profile-row">
          <div className="avatar">
            {profile?.foto ? (
              <img src={profile.foto} alt={fullName} className="avatar-img" />
            ) : (
              `${(profile?.nombres?.[0] || '')}${(profile?.apellidos?.[0] || '')}`.toUpperCase()
            )}
          </div>
          <div className="profile-info">
            <h2>{fullName || user?.email}</h2>
            <p>{profile?.email || user?.email}</p>
            {profile?.afiliado && <span className="badge-member">{t('profile.member')}</span>}
          </div>
          {!editing && (
            <button className="btn-icon" onClick={startEdit} aria-label={t('profile.edit')} title={t('profile.edit')}>
              <FaUserPen />
            </button>
          )}
          {!editing && profile?.foto && (
            <button
              type="button"
              className="btn btn-outline btn-sm text-danger"
              onClick={removePhoto}
              disabled={busy}
            >
              🗑️ Quitar foto
            </button>
          )}
        </div>

        {!editing && (profile?.edad || profile?.sexo) && (
          <p className="profile-since">
            {[profile?.['edad'] && `${t('profile.age')}: ${profile.edad}`, profile?.sexo && `${t('profile.sex')}: ${t(`profile.sex.${profile.sexo}`)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {profile?.fechaRegistro && (
          <p className="profile-since">
            {t('profile.memberSince')}: {formatDate(profile.fechaRegistro, lang)}
          </p>
        )}

        {!editing && profile?.tipoPersona === 'juridico' && (
          <div className="company-block">
            <h4>{t('profile.companyData')}</h4>
            <ul className="admin-list">
              <li><strong>{t('home.rif')}:</strong> {profile.rif || t('admin.notProvided')}</li>
              <li><strong>{t('home.nombreEmpresa')}:</strong> {profile.nombreEmpresa || t('admin.notProvided')}</li>
              <li><strong>{t('home.cargo')}:</strong> {profile.cargo || t('admin.notProvided')}</li>
              <li><strong>{t('home.telefonoEmpresa')}:</strong> {profile.telefonoEmpresa || t('admin.notProvided')}</li>
              <li><strong>{t('home.direccionFiscal')}:</strong> {profile.direccionFiscal || t('admin.notProvided')}</li>
              <li><strong>{t('home.direccionOficina')}:</strong> {profile.direccionOficina || t('admin.notProvided')}</li>
              <li><strong>{t('home.cedula')}:</strong> {profile.cedula || t('admin.notProvided')}</li>
              <li><strong>{t('home.contactoFacturaNombre')}:</strong> {profile.contactoFacturaNombre || t('admin.notProvided')}</li>
              <li><strong>{t('home.contactoFacturaEmail')}:</strong> {profile.contactoFacturaEmail || t('admin.notProvided')}</li>
              <li><strong>{t('home.responsableNombre')}:</strong> {profile.responsableNombre || t('admin.notProvided')}</li>
              <li><strong>{t('home.responsableTelefono')}:</strong> {profile.responsableTelefono || t('admin.notProvided')}</li>
              <li><strong>{t('home.comoSeEntero')}:</strong> {profile.comoSeEntero ? t(`home.comoSeEntero.${profile.comoSeEntero}`) : t('admin.notProvided')}</li>
            </ul>
          </div>
        )}

        {!editing && profile?.tipoPersona === 'juridico' && (
          <CompanyEmployees companyUid={user?.uid} companyName={profile?.nombreEmpresa} />
        )}

        {editing ? (
          <form className="form form-pad" onSubmit={save}>
            <div className="field-row">
              <label className="field-label">
                <span>{t('home.firstName')}</span>
                <input className="input" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} required />
              </label>
              <label className="field-label">
                <span>{t('home.lastName')}</span>
                <input className="input" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required />
              </label>
            </div>
            <label className="field-label">
              <span>{t('home.phone')}</span>
              <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} required />
            </label>
            <div className="field-row">
              <label className="field-label">
                <span>{t('profile.dni')} <em>({t('profile.dniHint')})</em></span>
                <input className="input" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
              </label>
              <label className="field-label">
                <span>{t('home.email')}</span>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">
                <span>{t('profile.age')}</span>
                <input type="number" min="0" max="120" className="input" value={form.edad ?? ''} onChange={(e) => setForm({ ...form, edad: e.target.value })} />
              </label>
              <div className="field-label">
                <span>{t('profile.sex')}</span>
                <select className="input" value={form.sexo ?? ''} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">—</option>
                  <option value="f">{t('profile.sex.f')}</option>
                  <option value="m">{t('profile.sex.m')}</option>
                  <option value="o">{t('profile.sex.o')}</option>
                </select>
              </div>
            </div>
            <div className="field-label">
              <span>{t('profile.photo')} <em>({t('profile.photoHint')})</em></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label className="photo-upload" style={{ cursor: 'pointer' }}>
                  {form.foto ? (
                    <img src={form.foto} alt={t('profile.photo')} className="photo-upload-img" />
                  ) : (
                    <span className="photo-upload-empty">{t('profile.noPhoto')}</span>
                  )}
                  <input type="file" accept="image/jpeg,image/png" className="hidden-input" onChange={onPhoto} />
                </label>
                {form.foto && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm text-danger"
                    onClick={() => setForm({ ...form, foto: '' })}
                  >
                    🗑️ Quitar foto
                  </button>
                )}
              </div>
              {reading && <p className="receipt-hint">{t('profile.readingFile')}</p>}
            </div>

            {profile?.tipoPersona === 'juridico' && (
              <div className="company-edit">
                <h4>{t('profile.editCompany')}</h4>
                <div className="field-row">
                  <label className="field-label">
                    <span>{t('home.rif')}</span>
                    <input className="input" value={form.rif ?? ''} onChange={(e) => setForm({ ...form, rif: e.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>{t('home.cedula')}</span>
                    <input className="input" value={form.cedula ?? ''} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
                  </label>
                </div>
                <label className="field-label">
                  <span>{t('home.nombreEmpresa')}</span>
                  <input className="input" value={form.nombreEmpresa ?? ''} onChange={(e) => setForm({ ...form, nombreEmpresa: e.target.value })} />
                </label>
                <div className="field-row">
                  <label className="field-label">
                    <span>{t('home.telefonoCelular')}</span>
                    <input className="input" value={form.telefonoCelular ?? ''} onChange={(e) => setForm({ ...form, telefonoCelular: e.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>{t('home.telefonoEmpresa')}</span>
                    <input className="input" value={form.telefonoEmpresa ?? ''} onChange={(e) => setForm({ ...form, telefonoEmpresa: e.target.value })} />
                  </label>
                </div>
                <label className="field-label">
                  <span>{t('home.cargo')}</span>
                  <input className="input" value={form.cargo ?? ''} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                </label>
                <label className="field-label">
                  <span>{t('home.direccionFiscal')}</span>
                  <input className="input" value={form.direccionFiscal ?? ''} onChange={(e) => setForm({ ...form, direccionFiscal: e.target.value })} />
                </label>
                <label className="field-label">
                  <span>{t('home.direccionOficina')}</span>
                  <input className="input" value={form.direccionOficina ?? ''} onChange={(e) => setForm({ ...form, direccionOficina: e.target.value })} />
                </label>
                <div className="field-row">
                  <label className="field-label">
                    <span>{t('home.contactoFacturaNombre')}</span>
                    <input className="input" value={form.contactoFacturaNombre ?? ''} onChange={(e) => setForm({ ...form, contactoFacturaNombre: e.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>{t('home.contactoFacturaEmail')}</span>
                    <input className="input" value={form.contactoFacturaEmail ?? ''} onChange={(e) => setForm({ ...form, contactoFacturaEmail: e.target.value })} />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field-label">
                    <span>{t('home.responsableNombre')}</span>
                    <input className="input" value={form.responsableNombre ?? ''} onChange={(e) => setForm({ ...form, responsableNombre: e.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>{t('home.responsableTelefono')}</span>
                    <input className="input" value={form.responsableTelefono ?? ''} onChange={(e) => setForm({ ...form, responsableTelefono: e.target.value })} />
                  </label>
                </div>
                <div className="field-label">
                  <span>{t('home.comoSeEntero')}</span>
                  <select className="input" value={form.comoSeEntero ?? ''} onChange={(e) => setForm({ ...form, comoSeEntero: e.target.value })}>
                    <option value="">—</option>
                    {['promocion', 'correo', 'redes', 'internet', 'referidos', 'otro'].map((o) => (
                      <option key={o} value={o}>{t(`home.comoSeEntero.${o}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? '...' : <><FaCheck /> {t('profile.save')}</>}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                <FaXmark /> {t('profile.cancel')}
              </button>
            </div>
          </form>
        ) : (
          saved && <p className="form-success">{t('profile.saved')}</p>
        )}
      </section>

      {/* Cambiar contraseña */}
      <section className="panel">
        <div className="panel-head">
          <FaLock />
          <h3>Cambiar contraseña</h3>
        </div>
        <p className="auth-hint">
          Si te registraron en un curso o empresa, tu clave inicial es tu cédula (sin puntos ni guiones).
          Cámbiala aquí cuando quieras.
        </p>
        <form className="form form-pad" onSubmit={handleChangePassword}>
          <div className="field-row">
            <label className="field-label">
              <span>Contraseña actual</span>
              <input
                type="password"
                className="input"
                value={passForm.current}
                onChange={(e) => setPassForm({ ...passForm, current: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              <span>Nueva contraseña</span>
              <input
                type="password"
                className="input"
                value={passForm.next}
                onChange={(e) => setPassForm({ ...passForm, next: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              <span>Confirmar nueva contraseña</span>
              <input
                type="password"
                className="input"
                value={passForm.confirm}
                onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })}
                required
              />
            </label>
          </div>
          {passMsg && <p className={passMsg.includes('correctamente') ? 'form-success' : 'form-error'}>{passMsg}</p>}
          <div className="btn-row" style={{ marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={passBusy}>
              {passBusy ? '...' : <><FaLock /> Cambiar contraseña</>}
            </button>
          </div>
        </form>
      </section>

      {/* Acceso a la página de afiliación */}
      <section className="aff-profile-cta">
        <div>
          <h3>{profile?.afiliado ? 'Afiliación AVGH' : 'Aún no eres afiliado'}</h3>
          <p>
            {profile?.afiliado
              ? 'Consulta los beneficios y mantén actualizados tus datos de afiliación.'
              : 'Conoce los planes individual y corporativo, los requisitos y los datos de pago.'}
          </p>
        </div>
        <Link to="/afiliacion" className="btn btn-primary btn-sm">
          {profile?.afiliado ? 'Ver afiliación' : 'Afiliarme'}
        </Link>
      </section>

      {/* Cursos inscritos */}
      <section className="panel">
        <div className="panel-head">
          <FaGraduationCap />
          <h3>{t('profile.myCourses')}</h3>
        </div>
        {loadingInsc || loadingAct ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : inscripciones.length === 0 ? (
          <div className="panel-empty">
            <p>{t('profile.noCourses')}</p>
            <Link to="/catalog/course" className="btn btn-primary btn-sm">{t('profile.browseCourses')}</Link>
          </div>
        ) : (
          <ul className="list">
            {inscripciones.map((ins) => {
              const isConfirmed = ins.estado === 'confirmada'
              const inscFactura = facturas.find((f) => f.actividadId === ins.actividadId)
              const isPaid = ['completada', 'aprobada'].includes(inscFactura?.estado) || (Number(ins.monto) === 0 && isConfirmed)
              const canShowQr = isConfirmed && isPaid
              return (
                <li key={ins.actividadId} className="list-item flex-wrap">
                  <div className="list-main">
                    <strong>{actTitle(ins.actividadId)}</strong>
                    <span className="list-sub">
                      {t('profile.enrolledOn')}: {formatDate(ins.fecha, lang)}
                      {ins.monto > 0 ? ` · ${CURRENCY}${ins.monto}` : ''}
                    </span>
                    {ins.nota && <span className="list-sub admin-note">Nota: {ins.nota}</span>}
                    {isConfirmed && !isPaid && (
                      <span className="list-sub" style={{ color: 'var(--warn)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                        ⚠️ {t('profile.invoiceReminder')}
                      </span>
                    )}
                  </div>
                  <div className="profile-insc-actions">
                    <span className={`badge badge-${ins.estado}`}>{t(`insc.status${cap(ins.estado)}`)}</span>
                    {canShowQr && (
                      <button className="btn btn-outline btn-sm" onClick={() => setShowQr(ins.actividadId)}>
                        QR
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Encuesta de satisfacción */}
      {(() => {
        const pendientes = inscripciones.filter(
          (i) => i.presente === true && !i.encuestaCompletada
        )
        if (pendientes.length === 0) return null
        return (
          <section className="panel">
            <div className="panel-head">
              <FaAward />
              <h3>Encuesta de satisfacción</h3>
            </div>
            <p className="auth-hint">
              Comparte tu experiencia. Al responder la encuesta podrás ver y descargar el certificado de la actividad.
            </p>
            <ul className="list">
              {pendientes.map((ins) => (
                <li key={ins.actividadId} className="list-item flex-wrap">
                  <div className="list-main">
                    <strong>{actTitle(ins.actividadId) || ins.actividadId}</strong>
                    <span className="list-sub">Participaste el {formatDate(ins.fechaAsistencia || ins.fecha, lang)}</span>
                  </div>
                  <div className="profile-insc-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSurveyDone(ins.actividadId)}
                    >
                      Responder encuesta
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })()}

      {/* Certificados emitidos */}
      <section className="panel">
        <div className="panel-head">
          <FaAward />
          <h3>{t('profile.certificates')}</h3>
        </div>
        {loadingCerts ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : certificadosVisibles.length === 0 ? (
          <div className="panel-empty">
            <p>{certificates.length === 0
              ? t('profile.certificatesEmpty')
              : 'Responde la encuesta de satisfacción de la actividad para poder ver y descargar tu certificado.'}</p>
          </div>
        ) : (
          <ul className="list">
            {certificadosVisibles.map((cert) => (
              <li key={cert.actividadId} className="list-item invoice-item">
                <div className="list-main">
                  <strong className="invoice-num">
                    <FaAward /> {actTitle(cert.actividadId) || cert.titulo}
                  </strong>
                  <span className="list-sub">
                    {t('profile.certificates')}: {cert.titulo || ''}
                  </span>
                  <span className="list-sub">
                    {cert.fecha || ''}
                    {cert.duracion ? ` · ${cert.duracion}` : ''}
                    {cert.modalidad ? ` · ${cert.modalidad}` : ''}
                  </span>
                </div>
                <div className="invoice-right">
                  <span className={`badge badge-${cert.estado || 'emitido'}`}>{cert.estado || 'emitido'}</span>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowCert(cert.actividadId)}>
                    <FaAward /> Ver / Descargar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Facturas y pagos */}
      <section className="panel">
        <div className="panel-head">
          <FaFileInvoice />
          <h3>{t('profile.invoices')}</h3>
        </div>
        {loadingFact ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : facturas.length === 0 ? (
          <div className="panel-empty"><p>{t('profile.noInvoices')}</p></div>
        ) : (
          <ul className="list">
            {facturas
              .slice()
              .sort((a, b) => (b.fecha || 0) - (a.fecha || 0))
              .map((f) => {
                const concepto = f.concepto && typeof f.concepto === 'object' ? (f.concepto[lang] || f.concepto.es) : f.concepto
                return (
                  <li key={f.id} className="list-item invoice-item">
                    <div className="list-main">
                      <strong className="invoice-num">
                        <FaClockRotateLeft /> {f.numero}
                      </strong>
                      <span className="list-sub">{concepto}</span>
                      <span className="list-sub">
                        {formatDate(f.fecha, lang)} · {t(paymentLabels[f.metodo] || 'insc.payment.transfer')}
                      </span>
                    </div>
                    <div className="invoice-right">
                      <strong>{f.monto > 0 ? `${CURRENCY}${f.monto}` : t('detail.free')}</strong>
                      <span className={`badge badge-${f.estado}`}>{t(`insc.status${cap(f.estado)}`)}</span>
                    </div>
                    <ReceiptUpload factura={f} uid={user?.uid} />
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      {showQr && (
        <TicketModal
          user={{ uid: user?.uid, email: user?.email, ...profile }}
          insc={inscripciones.find((i) => i.actividadId === showQr)}
          act={actividades.find((a) => a.id === showQr)}
          factura={facturas.find((f) => f.actividadId === showQr)}
          onClose={() => setShowQr(null)}
        />
      )}

      {showCert && (
        <CertificateModal
          user={{ uid: user?.uid, email: user?.email, ...profile }}
          insc={inscripciones.find((i) => i.actividadId === showCert)}
          act={actividades.find((a) => a.id === showCert)}
          mode="view"
          saved={certificates.find((c) => c.actividadId === showCert)}
          onClose={() => setShowCert(null)}
        />
      )}

      {showSurvey && (
        <SurveyModal
          user={user}
          profile={profile}
          insc={{ actividadId: showSurvey }}
          act={actividades.find((a) => a.id === showSurvey)}
          onClose={() => setShowSurvey(null)}
          onDone={() => {
            setShowSurvey(null)
            setSaved(true)
          }}
        />
      )}
    </div>
  )
}

function cap(s = '') {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}