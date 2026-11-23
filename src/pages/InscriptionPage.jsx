import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FaArrowLeft, FaCircleCheck, FaXmark, FaUsers, FaUserCheck } from 'react-icons/fa6'
import { ref, onValue, set } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { useActivity, createInscriptionWithCapacity, useBankConfig, uploadComprobante, useMyInscriptions, useAffiliationConfig, useInscripcionesCount } from '../data/useData'
import { calcularPrecioInscripcion } from '../data/pricing'
import { fileToStorable } from '../utils/files'
import Toggle from '../components/Toggle'
import { CURRENCY } from '../config'

export default function InscriptionPage() {
  const { tipo, id } = useParams()
  const { lang, t } = useLang()
  const { user, profile, updateProfileData } = useAuth()
  const { item, loading } = useActivity(id)
  const { config: bank } = useBankConfig()
  const { config: affConfig } = useAffiliationConfig()
  const { items: myInscriptions } = useMyInscriptions(user?.uid)
  const counts = useInscripcionesCount()
  const cupoTotal = Math.max(0, Number(item?.cupo) || 0)
  const ocupados = counts[id] || 0
  const disponibles = cupoTotal > 0 ? Math.max(0, cupoTotal - ocupados) : Infinity
  const cupoLleno = disponibles <= 0
  const [listaEspera, setListaEspera] = useState(false)
  const [metodoPago, setMetodoPago] = useState('transfer')
  const [comprobanteFile, setComprobanteFile] = useState(null)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [employeesList, setEmployeesList] = useState([])
  const [form, setForm] = useState({
    nombres: '', apellidos: '', dni: '', cedula: '', email: '', telefono: '', telefonoCelular: '',
    rif: '', nombreEmpresa: '', telefonoEmpresa: '', cargo: '',
    direccionFiscal: '', direccionOficina: '',
    contactoFacturaNombre: '', contactoFacturaEmail: '',
    responsableNombre: '', responsableTelefono: '', comoSeEntero: '', comoSeEnteroOtro: ''
  })
  const [facturaJuridica, setFacturaJuridica] = useState(false)
  const formReady = useRef(false)

  // Prellenar con el perfil (puede llegar después del mount) y permitir editar.
  useEffect(() => {
    if (!profile || formReady.current) return
    formReady.current = true
    const juridico = profile.tipoPersona === 'juridico' || !!profile.rif || !!profile.nombreEmpresa
    setFacturaJuridica(juridico)
    setForm((f) => ({
      ...f,
      nombres: profile.nombres || '',
      apellidos: profile.apellidos || '',
      dni: profile.dni || '',
      cedula: profile.cedula || profile.dni || '',
      email: profile.email || user?.email || '',
      telefono: profile.telefono || profile.telefonoCelular || '',
      telefonoCelular: profile.telefonoCelular || profile.telefono || '',
      rif: profile.rif || '',
      nombreEmpresa: profile.nombreEmpresa || profile.empresa || '',
      telefonoEmpresa: profile.telefonoEmpresa || '',
      cargo: profile.cargo || '',
      direccionFiscal: profile.direccionFiscal || '',
      direccionOficina: profile.direccionOficina || '',
      contactoFacturaNombre: profile.contactoFacturaNombre || '',
      contactoFacturaEmail: profile.contactoFacturaEmail || '',
      responsableNombre: profile.responsableNombre || '',
      responsableTelefono: profile.responsableTelefono || '',
      comoSeEntero: profile.comoSeEntero || ''
    }))
  }, [profile, user])

  const datosFacturacion = {
    facturaJuridica,
    nombres: form.nombres,
    apellidos: form.apellidos,
    dni: form.dni || form.cedula,
    cedula: form.cedula || form.dni,
    email: form.email,
    telefono: form.telefono,
    rif: facturaJuridica ? form.rif : '',
    nombreEmpresa: facturaJuridica ? form.nombreEmpresa : '',
    telefonoEmpresa: facturaJuridica ? form.telefonoEmpresa : '',
    cargo: facturaJuridica ? form.cargo : '',
    direccionFiscal: facturaJuridica ? form.direccionFiscal : '',
    direccionOficina: facturaJuridica ? form.direccionOficina : '',
    contactoFacturaNombre: facturaJuridica ? form.contactoFacturaNombre : '',
    contactoFacturaEmail: facturaJuridica ? form.contactoFacturaEmail : '',
    responsableNombre: form.responsableNombre,
    responsableTelefono: form.responsableTelefono,
    comoSeEntero: form.comoSeEntero === 'otro' ? (form.comoSeEnteroOtro || 'Otro') : form.comoSeEntero
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // Cargar lista de empleados de la empresa si el usuario es de tipo jurídico
  useEffect(() => {
    if (profile?.tipoPersona === 'juridico' && user?.uid) {
      const empRef = ref(db, `${DB_ROOT}/companies/${user.uid}/employees`)
      const unsub = onValue(empRef, (snap) => {
        const val = snap.val() || {}
        const list = Object.entries(val).map(([id, item]) => ({ id, ...item }))
        setEmployeesList(list)
      })
      return () => unsub()
    }
  }, [profile, user])

  const copyText = (txt) => {
    navigator.clipboard.writeText(txt)
    alert(t('insc.copied') || '¡Copiado!')
  }

  if (loading) return <div className="page"><div className="loading">{t('cat.loading')}</div></div>

  if (!item) {
    return (
      <div className="page">
        <div className="empty">
          <p>{t('cat.empty')}</p>
          <Link to="/" className="btn btn-primary">{t('insc.goHome')}</Link>
        </div>
      </div>
    )
  }

  const title = item.titulo && typeof item.titulo === 'object' ? item.titulo[lang] : item.titulo
  const fullName = profile ? `${profile.nombres || ''} ${profile.apellidos || ''}`.trim() : ''

  if (done) {
    return (
      <div className="page">
        <div className="success-card">
          <div className="success-icon"><FaCircleCheck /></div>
          <h2>¡Tu inscripción está confirmada!</h2>
          <p>
            Nos complace darte la bienvenida a nuestra <strong>{title || 'actividad AVGH'}</strong>.
            <br />
            Estamos preparados para recibirte y compartir una experiencia enriquecedora, llena de
            conocimientos, tendencias y oportunidades para conectar con destacados profesionales y
            líderes empresariales.
          </p>
          <div className="success-invoice">
            <span>{t('insc.invoiceNumber')}</span>
            <strong>{done.numeroFactura}</strong>
          </div>
          <div className="success-total">
            <span>{t('insc.total')}</span>
            <strong>{done.monto > 0 ? `${CURRENCY}${done.monto}` : t('detail.free')}</strong>
          </div>
          <Link to="/perfil" className="btn btn-primary btn-block">{t('insc.seeProfile')}</Link>
          <Link to="/" className="link-muted">{t('insc.goHome')}</Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page">
        <div className="empty">
          <p>{t('insc.pleaseLogin')}</p>
          <Link to="/" className="btn btn-primary btn-block">{t('detail.loginNow')}</Link>
        </div>
      </div>
    )
  }

  const isCompany = profile?.tipoPersona === 'juridico'
  const countParticipants = isCompany && selectedEmployees.length > 0 ? selectedEmployees.length : 1
  const pricing = calcularPrecioInscripcion({
    precio: item?.precio,
    profile,
    config: affConfig,
    countParticipants
  })
  const {
    precioBase,
    descuentoPorcentaje,
    descuentoUnitario,
    descuentoMonto,
    montoUnitario,
    montoFinal: totalMonto,
    planAfiliacion
  } = pricing
  const isFree = precioBase <= 0 || totalMonto <= 0
  const precioNum = precioBase

  const toggleSelectEmp = (empId) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!terms) {
      setError(t('insc.terms'))
      return
    }
    setBusy(true)
    try {
      if (!user?.uid) {
        throw new Error('No hay sesión de usuario activa. Inicia sesión de nuevo.')
      }
      if (!item?.id) {
        throw new Error('No se encontró la actividad seleccionada.')
      }

      if (isCompany && selectedEmployees.length > 0) {
        // Verificar si alguno de los empleados seleccionados ya está inscrito en esta actividad
        const alreadyEnrolled = selectedEmployees.filter((empId) => {
          const empData = employeesList.find((e) => e.id === empId)
          return empData && empData.actividadId === item.id
        })
        if (alreadyEnrolled.length > 0) {
          throw new Error('Uno o más de los empleados seleccionados ya se encuentran inscritos en esta actividad.')
        }

        // Inscribir individualmente a cada empleado seleccionado
        let lastResult = null
        let reservados = 0
        for (const empId of selectedEmployees) {
          const empData = employeesList.find((e) => e.id === empId)
          if (empData) {
            const fakeUid = `emp_${empData.dni ? empData.dni.replace(/\D/g, '') : Date.now()}_${Math.floor(Math.random() * 1000)}`
            lastResult = await createInscriptionWithCapacity({
              uid: fakeUid,
              yaReservados: reservados,
              actividad: item,
              user: {
                nombres: empData.nombres,
                apellidos: empData.apellidos || '',
                dni: empData.dni,
                email: empData.email || `${empData.dni}@avgh.local`,
                empresa: profile?.nombreEmpresa || '',
                ...datosFacturacion,
                nombres: empData.nombres,
                apellidos: empData.apellidos || '',
                dni: empData.dni,
                email: empData.email || `${empData.dni}@avgh.local`
              },
              facturacion: datosFacturacion,
              metodoPago: isFree ? 'gratis' : metodoPago,
              estado: 'pendiente',
              monto: isFree ? 0 : montoUnitario,
              afiliado: pricing.afiliado,
              planAfiliacion,
              desglose: {
                precioBase,
                descuentoPorcentaje,
                descuentoMonto: descuentoUnitario,
                montoUnitario: isFree ? 0 : montoUnitario,
                afiliado: pricing.afiliado,
                planAfiliacion,
                countParticipants: 1
              }
            })
            if (!lastResult.listaEspera) reservados += 1
            // Actualizar la última actividad asociada al empleado en la DB
            await set(ref(db, `${DB_ROOT}/companies/${user.uid}/employees/${empId}/actividadId`), item.id)
          }
        }
        setDone(lastResult || { numeroFactura: `FAC-COMP-${Date.now().toString().slice(-5)}` })
      } else {
        // Verificar si el usuario titular ya está inscrito en esta actividad
        const alreadyInscribed = myInscriptions.some((ins) => ins.actividadId === item.id)
        if (alreadyInscribed) {
          throw new Error('Ya te encuentras inscrito en esta actividad. No puedes duplicar tu inscripción.')
        }

        // Inscribir al titular de la cuenta
        const result = await createInscriptionWithCapacity({ 
          uid: user.uid, 
          actividad: item, 
          user: {
            ...datosFacturacion,
            nombres: form.nombres || user.displayName || 'Participante',
            apellidos: form.apellidos || '',
            dni: form.dni || user.email || '',
            email: form.email || user.email || '',
            telefono: form.telefono || ''
          },
          facturacion: datosFacturacion,
          metodoPago: isFree ? 'gratis' : metodoPago,
          monto: isFree ? 0 : montoUnitario,
          afiliado: pricing.afiliado,
          planAfiliacion,
          desglose: {
            precioBase,
            descuentoPorcentaje,
            descuentoMonto: descuentoUnitario,
            montoUnitario: isFree ? 0 : montoUnitario,
            afiliado: pricing.afiliado,
            planAfiliacion,
            countParticipants: 1
          }
        })
        try {
          await updateProfileData({
            nombres: form.nombres, apellidos: form.apellidos, dni: form.dni,
            cedula: form.cedula, email: form.email, telefono: form.telefono,
            telefonoCelular: form.telefonoCelular, rif: form.rif,
            nombreEmpresa: form.nombreEmpresa, telefonoEmpresa: form.telefonoEmpresa,
            cargo: form.cargo, direccionFiscal: form.direccionFiscal,
            direccionOficina: form.direccionOficina, contactoFacturaNombre: form.contactoFacturaNombre,
            contactoFacturaEmail: form.contactoFacturaEmail, responsableNombre: form.responsableNombre,
            responsableTelefono: form.responsableTelefono, comoSeEntero: datosFacturacion.comoSeEntero
          })
        } catch { /* no bloqueamos la inscripción si falla la actualización del perfil */ }
        setDone(result)
      }
    } catch (err) {
      console.error('Inscription error detail:', err)
      const msg = (err && (err.message || err.toString())) || 'Error desconocido'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <Link to={`/actividad/${tipo}/${id}`} className="btn-icon" aria-label="Volver">
          <FaArrowLeft />
        </Link>
        <div className="page-head-text">
          <h1>{t('insc.title')}</h1>
          <p>{t('insc.subtitle')}</p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <div className="form-activity">
          <span className="activity-badge">{t(`type.${item.tipo}`)}</span>
          <strong>{title}</strong>
        </div>

        {cupoTotal > 0 && (
          <div className={`cupo-msg ${cupoLleno ? 'is-full' : ''}`}>
            <FaUsers /> {cupoLleno
              ? 'Cupo completo · Al inscribirte quedarás en lista de espera'
              : `¡Quedan ${disponibles} ${disponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}!`}
          </div>
        )}

        <div className="insc-form-section">
          <h4 className="detail-section-title">Datos personales</h4>
          <div className="field-row">
            <label className="field-label">
              <span>{t('home.lastName')} / Apellidos</span>
              <input className="input" value={form.apellidos} onChange={setField('apellidos')} required />
            </label>
            <label className="field-label">
              <span>{t('home.firstName')} / Nombres</span>
              <input className="input" value={form.nombres} onChange={setField('nombres')} required />
            </label>
          </div>
          <div className="field-row">
            <label className="field-label">
              <span>CI / Documento</span>
              <input className="input" value={form.dni} onChange={setField('dni')} required />
            </label>
            <label className="field-label">
              <span>{t('insc.email')}</span>
              <input type="email" className="input" value={form.email} onChange={setField('email')} required />
            </label>
          </div>
          <div className="field-row">
            <label className="field-label">
              <span>N° Cel.</span>
              <input className="input" value={form.telefono} onChange={setField('telefono')} />
            </label>
            <label className="field-label">
              <span>Teléfono fijo (opcional)</span>
              <input className="input" value={form.telefonoCelular} onChange={setField('telefonoCelular')} />
            </label>
          </div>
        </div>

        {isCompany && (
          <div className="admin-section" style={{ margin: '16px 0', padding: '16px', background: 'var(--bg-muted)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FaUsers className="text-primary" />
              <h4 style={{ margin: 0 }}>Seleccionar Empleados a Inscribir</h4>
            </div>
            <p className="auth-hint" style={{ fontSize: '12px', marginBottom: '12px' }}>
              Selecciona qué empleados de tu plantilla deseas inscribir en este evento. Si no seleccionas ninguno, la inscripción se registrará a nombre del usuario titular de la empresa.
            </p>

            {employeesList.length === 0 ? (
              <p className="auth-hint" style={{ fontSize: '13px', fontStyle: 'italic' }}>
                No tienes empleados agregados a la plantilla. Puedes agregarlos desde tu Perfil de Empresa o continuar inscribiendo al titular.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {employeesList.map((emp) => {
                  const isChecked = selectedEmployees.includes(emp.id)
                  return (
                    <label
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        background: isChecked ? 'var(--card)' : 'transparent',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: isChecked ? '1.5px solid var(--blue)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectEmp(emp.id)}
                        />
                        <div>
                          <strong>{emp.nombres} {emp.apellidos}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Cédula: {emp.dni} {emp.cargo ? `· ${emp.cargo}` : ''}
                          </span>
                        </div>
                      </div>
                      {isChecked && <FaUserCheck style={{ color: 'var(--success)' }} />}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="insc-form-section">
          <div className="field-label gratis-afiliados-box">
            <Toggle
              id="facturaJuridica"
              checked={facturaJuridica}
              onChange={setFacturaJuridica}
              label="¿Requiere factura jurídica?"
            />
            <em>Active esta opción si la factura se emitirá a nombre de una empresa. Si no, se emitirá como factura natural a su nombre.</em>
          </div>

          {facturaJuridica && (
            <div className="insc-company-fields">
              <h4 className="detail-section-title">Datos de la empresa (para facturación)</h4>
              <div className="field-row">
                <label className="field-label">
                  <span>Nombre de la Empresa</span>
                  <input className="input" value={form.nombreEmpresa} onChange={setField('nombreEmpresa')} required />
                </label>
                <label className="field-label">
                  <span>N° RIF</span>
                  <input className="input" value={form.rif} onChange={setField('rif')} required />
                </label>
              </div>
              <div className="field-row">
                <label className="field-label">
                  <span>Teléfonos de la empresa</span>
                  <input className="input" value={form.telefonoEmpresa} onChange={setField('telefonoEmpresa')} />
                </label>
                <label className="field-label">
                  <span>Cargo desempeñado</span>
                  <input className="input" value={form.cargo} onChange={setField('cargo')} />
                </label>
              </div>
              <label className="field-label">
                <span>Dirección Fiscal</span>
                <input className="input" value={form.direccionFiscal} onChange={setField('direccionFiscal')} />
              </label>
              <label className="field-label">
                <span>Dirección Oficina (envío de factura)</span>
                <input className="input" value={form.direccionOficina} onChange={setField('direccionOficina')} />
              </label>
              <div className="field-row">
                <label className="field-label">
                  <span>Persona contacto recepción factura</span>
                  <input className="input" value={form.contactoFacturaNombre} onChange={setField('contactoFacturaNombre')} />
                </label>
                <label className="field-label">
                  <span>Correo (contacto factura)</span>
                  <input type="email" className="input" value={form.contactoFacturaEmail} onChange={setField('contactoFacturaEmail')} />
                </label>
              </div>
              <div className="field-row">
                <label className="field-label">
                  <span>Persona responsable de la inscripción</span>
                  <input className="input" value={form.responsableNombre} onChange={setField('responsableNombre')} />
                </label>
                <label className="field-label">
                  <span>Tel. f. responsable</span>
                  <input className="input" value={form.responsableTelefono} onChange={setField('responsableTelefono')} />
                </label>
              </div>
            </div>
          )}

          <label className="field-label">
            <span>¿Cómo se enteró del evento?</span>
            <select className="input" value={form.comoSeEntero} onChange={setField('comoSeEntero')}>
              <option value="">Seleccione...</option>
              <option value="promocion">Promoción</option>
              <option value="correo">E-mail</option>
              <option value="redes">RRSS</option>
              <option value="internet">Internet</option>
              <option value="referidos">Referidos</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          {form.comoSeEntero === 'otro' && (
            <label className="field-label">
              <span>Especifique</span>
              <input className="input" value={form.comoSeEnteroOtro} onChange={setField('comoSeEnteroOtro')} placeholder="Otro" />
            </label>
          )}
        </div>

        <div className="price-bar">
          <span>{t('insc.total')} {countParticipants > 1 ? `(${countParticipants} participantes)` : ''}</span>
          <strong>{!isFree ? `${CURRENCY}${totalMonto}` : t('detail.free')}</strong>
        </div>
        {descuentoPorcentaje > 0 && !isFree && (
          <div className="discount-note">
            {t('insc.regularPrice')}: {CURRENCY}{precioBase * countParticipants} · {t('insc.discountApplied')} {descuentoPorcentaje}% ({planAfiliacion === 'corporativo' ? t('aff.corporativo') : t('aff.individual')}) · {t('insc.youSave')} {CURRENCY}{descuentoMonto}
          </div>
        )}

        {!isFree && (
          <>
            <div className="field-label">
              <span>{t('insc.payment')}</span>
              <div className="radio-group">
                {['transfer', 'mobile', 'binance', 'cash', 'card'].map((m) => (
                  <label key={m} className={`radio-card ${metodoPago === m ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="metodoPago"
                      value={m}
                      checked={metodoPago === m}
                      onChange={() => setMetodoPago(m)}
                    />
                    <span>{t(`insc.payment.${m}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            {metodoPago === 'binance' && bank && (
              <div className="bank-info-box">
                <h4>Datos para Binance Pay</h4>
                <ul className="admin-list">
                  <li>
                    <strong>Binance Pay ID / Correo:</strong> {bank.binanceId || 'No configurado'}{' '}
                    {bank.binanceId && <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(bank.binanceId)}>Copiar</button>}
                  </li>
                  <li><strong>Titular / Alias:</strong> {bank.binanceName || 'AVGH'}</li>
                </ul>
              </div>
            )}

            {(metodoPago === 'transfer' || metodoPago === 'mobile') && bank && (
              <div className="bank-info-box">
                <h4>{t('insc.bankDetailsTitle')}</h4>
                {metodoPago === 'transfer' && bank.bancoNombre && (
                  <ul className="admin-list">
                    <li><strong>{t('admin.bankName')}:</strong> {bank.bancoNombre}</li>
                    <li>
                      <strong>{t('admin.bankNumber')}:</strong> {bank.numeroCuenta}{' '}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(bank.numeroCuenta)}>Copiar</button>
                    </li>
                    <li><strong>{t('admin.bankHolder')}:</strong> {bank.beneficiario}</li>
                    <li>
                      <strong>{t('admin.bankRif')}:</strong> {bank.rifCedula}{' '}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(bank.rifCedula)}>Copiar</button>
                    </li>
                    <li><strong>{t('admin.bankType')}:</strong> {bank.tipoCuenta}</li>
                  </ul>
                )}
                {metodoPago === 'mobile' && bank.pagoMovilBanco && (
                  <ul className="admin-list">
                    <li><strong>{t('admin.pmBank')}:</strong> {bank.pagoMovilBanco}</li>
                    <li>
                      <strong>{t('admin.pmPhone')}:</strong> {bank.pagoMovilTelefono}{' '}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(bank.pagoMovilTelefono)}>Copiar</button>
                    </li>
                    <li>
                      <strong>{t('admin.pmRif')}:</strong> {bank.pagoMovilRif}{' '}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(bank.pagoMovilRif)}>Copiar</button>
                    </li>
                  </ul>
                )}
                {bank.observaciones && <p className="list-sub" style={{ marginTop: '8px' }}>{bank.observaciones}</p>}
              </div>
            )}
          </>
        )}

        <div style={{ margin: '14px 0 6px' }}>
          <button type="button" className="link-muted" onClick={() => setShowTermsModal(true)}>
            {t('insc.readTerms')}
          </button>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>{t('insc.terms')}</span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? t('insc.submitting') : t('insc.submit')}
        </button>
      </form>

      {showTermsModal && (
        <div className="qr-modal-backdrop" onClick={() => setShowTermsModal(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="admin-detail-head">
              <h3>{t('insc.termsTitle')}</h3>
              <button className="btn-icon" onClick={() => setShowTermsModal(false)} aria-label={t('admin.close')}>
                <FaXmark />
              </button>
            </div>
            <div className="qr-modal-content" style={{ textAlign: 'left', maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6', color: 'var(--text)' }}>
                {bank?.terminosCondiciones || 'No se han configurado términos y condiciones todavía por el administrador.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}