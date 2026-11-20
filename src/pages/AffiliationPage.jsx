import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaUser,
  FaBuilding,
  FaCheck,
  FaIdCard,
  FaBuildingColumns,
  FaFileArrowUp,
  FaArrowLeft,
  FaCircleCheck,
  FaCopy,
  FaTriangleExclamation,
  FaLock
} from 'react-icons/fa6'
import { useAuth } from '../auth/AuthContext'
import { useAffiliationConfig, useBankConfig } from '../data/useData'
import { AFFILIATION_DEFAULTS, getAffiliationPlan } from '../data/affiliationDefaults'
import { fileToStorable } from '../utils/files'
import { ref, set } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'

function TextField({ label, value, onChange, type = 'text', required, placeholder, hint, ...rest }) {
  return (
    <label className="field-label">
      <span>
        {label}
        {required && <span className="aff-required"> *</span>}
      </span>
      <input
        className="input"
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {hint && <em>{hint}</em>}
    </label>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  return (
    <label className="field-label">
      <span>
        {label}
        {required && <span className="aff-required"> *</span>}
      </span>
      <select className="input" value={value ?? ''} required={required} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function FileField({ label, value, onChange }) {
  const id = useId()
  return (
    <label className="file-box" htmlFor={id}>
      <span className="file-box-title">{label}</span>
      <span className="file-box-btn">
        <FaFileArrowUp /> Seleccionar archivo
      </span>
      <input id={id} type="file" accept="image/jpeg,image/png,application/pdf" onChange={onChange} />
      {value ? (
        <span className="file-ok">
          <FaCheck /> {value.name}
        </span>
      ) : (
        <span className="file-hint">JPG, PNG o PDF · máx. 4 MB</span>
      )}
    </label>
  )
}

function CopyValue({ label, value, copy }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // El portapapeles puede estar bloqueado por el navegador.
    }
  }

  return (
    <div className="aff-bank-row">
      <span>{label}</span>
      <strong>{value}</strong>
      {copy && (
        <button type="button" className="btn btn-outline btn-sm" onClick={handleCopy}>
          <FaCopy /> {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </div>
  )
}

function BankDetails({ bank, loading }) {
  const transferRows = [
    { label: 'Banco', value: bank?.bancoNombre },
    { label: 'Tipo de cuenta', value: bank?.tipoCuenta },
    { label: 'Número de cuenta', value: bank?.numeroCuenta, copy: true },
    { label: 'Titular', value: bank?.beneficiario },
    { label: 'RIF / Cédula', value: bank?.rifCedula, copy: true }
  ].filter((row) => row.value)

  const mobileRows = [
    { label: 'Banco', value: bank?.pagoMovilBanco },
    { label: 'Teléfono', value: bank?.pagoMovilTelefono, copy: true },
    { label: 'RIF / Cédula', value: bank?.pagoMovilRif, copy: true }
  ].filter((row) => row.value)

  const hasTransfer = transferRows.length > 0
  const hasMobile = mobileRows.length > 0
  const hasBinance = Boolean(bank?.binanceId)
  const hasZelle = Boolean(bank?.zelleEmail)

  return (
    <div className="aff-bank-box">
      <div className="aff-bank-head">
        <FaBuildingColumns />
        <h4>Datos para realizar el pago</h4>
      </div>

      {loading ? (
        <p className="aff-muted">Cargando la información bancaria configurada por el administrador…</p>
      ) : !hasTransfer && !hasMobile && !hasBinance && !hasZelle ? (
        <p className="aff-alert">
          <FaTriangleExclamation />
          El administrador todavía no ha configurado los datos bancarios. Escríbenos a{' '}
          <strong>afiliaciones@avgh.org.ve</strong> para recibir las instrucciones de pago.
        </p>
      ) : (
        <>
          <div className="aff-bank-grid">
            {hasTransfer && (
              <div className="aff-bank-card">
                <h5>Transferencia bancaria</h5>
                {transferRows.map((row) => (
                  <CopyValue key={row.label} {...row} />
                ))}
              </div>
            )}

            {hasMobile && (
              <div className="aff-bank-card">
                <h5>Pago móvil</h5>
                {mobileRows.map((row) => (
                  <CopyValue key={row.label} {...row} />
                ))}
              </div>
            )}

            {hasBinance && (
              <div className="aff-bank-card">
                <h5>Binance Pay</h5>
                <CopyValue label="ID / Correo" value={bank.binanceId} copy />
                {bank.binanceName && <CopyValue label="Alias / Titular" value={bank.binanceName} />}
              </div>
            )}

            {hasZelle && (
              <div className="aff-bank-card">
                <h5>Zelle / Internacional</h5>
                <CopyValue label="Email / Teléfono" value={bank.zelleEmail} copy />
                {bank.zelleTitular && <CopyValue label="Titular" value={bank.zelleTitular} />}
              </div>
            )}
          </div>

          {bank?.observaciones && <p className="aff-bank-note">{bank.observaciones}</p>}
        </>
      )}

      <p className="aff-bank-note">
        Envía el comprobante junto con tu planilla. También puedes escribir a{' '}
        <strong>afiliaciones@avgh.org.ve</strong> o <strong>informacion@avgh.org.ve</strong>.
      </p>
    </div>
  )
}

function TermsBox({ terms }) {
  return (
    <div className="aff-terms-box">
      <h4>Términos y condiciones de afiliación</h4>
      {terms ? (
        <p>{terms}</p>
      ) : (
        <p className="aff-muted">
          El administrador todavía no ha publicado los términos y condiciones. Puedes continuar con tu solicitud y
          recibirás las indicaciones por correo.
        </p>
      )}
    </div>
  )
}

function BenefitsList({ items }) {
  return (
    <ul className="aff-benefits">
      {items.map((item) => (
        <li key={item}>
          <span className="aff-benefit-icon">
            <FaCheck />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AffiliationPage() {
  const { user, profile } = useAuth()
  const { config: bankConfig, loading: loadingBank } = useBankConfig()
  const { config: affiliationConfig } = useAffiliationConfig()

  const [activePlan, setActivePlan] = useState('individual')
  const [viewMode, setViewMode] = useState('info')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)

  const [formInd, setFormInd] = useState({
    nombres: profile?.nombres || '',
    apellidos: profile?.apellidos || '',
    lugarNacimiento: '',
    fechaNacimiento: '',
    nacionalidad: 'Venezolana',
    dni: profile?.dni || '',
    direccionHabitacion: '',
    ciudad: '',
    estado: '',
    telefonos: profile?.telefono || '',
    email: profile?.email || user?.email || '',
    movil: '',
    titulo1: '',
    institucion1: '',
    fecha1: '',
    titulo2: '',
    institucion2: '',
    fecha2: '',
    empresa: '',
    direccionEmpresa: '',
    telefonoEmpresa: '',
    emailEmpresa: '',
    sectorEconomico: '',
    cargo: '',
    metodoPago: 'transfer',
    cedulaFile: null,
    cvFile: null,
    ref1File: null,
    ref2File: null,
    pagoFile: null
  })

  const [formCorp, setFormCorp] = useState({
    razonSocial: profile?.nombreEmpresa || '',
    rif: profile?.rif || '',
    sector: 'Banca',
    sectorOtro: '',
    direccion: profile?.direccionFiscal || '',
    ciudad: '',
    estado: '',
    telefonos: profile?.telefonoEmpresa || '',
    emailCorp: profile?.email || user?.email || '',
    web: '',
    redes: '',
    contactoNombres: profile?.nombres || '',
    contactoApellidos: profile?.apellidos || '',
    contactoDni: profile?.dni || '',
    contactoCargo: profile?.cargo || '',
    contactoDept: '',
    contactoTels: profile?.telefono || '',
    contactoMovil: '',
    contactoEmail: profile?.email || user?.email || '',
    gerenteNombres: '',
    gerenteApellidos: '',
    gerenteDni: '',
    gerenteCargo: '',
    gerenteTels: '',
    gerenteMovil: '',
    gerenteEmail: '',
    adminNombres: '',
    adminApellidos: '',
    adminDni: '',
    adminCargo: '',
    adminTels: '',
    adminMovil: '',
    adminEmail: '',
    metodoPago: 'transfer',
    rifFile: null,
    mercantilFile: null,
    pagoFile: null
  })

  // Completa los datos del formulario cuando el perfil termina de cargar.
  useEffect(() => {
    if (!profile && !user) return
    setFormInd((prev) => ({
      ...prev,
      nombres: prev.nombres || profile?.nombres || '',
      apellidos: prev.apellidos || profile?.apellidos || '',
      dni: prev.dni || profile?.dni || '',
      telefonos: prev.telefonos || profile?.telefono || '',
      email: prev.email || profile?.email || user?.email || ''
    }))
    setFormCorp((prev) => ({
      ...prev,
      razonSocial: prev.razonSocial || profile?.nombreEmpresa || '',
      rif: prev.rif || profile?.rif || '',
      direccion: prev.direccion || profile?.direccionFiscal || '',
      telefonos: prev.telefonos || profile?.telefonoEmpresa || '',
      emailCorp: prev.emailCorp || profile?.email || user?.email || '',
      contactoNombres: prev.contactoNombres || profile?.nombres || '',
      contactoApellidos: prev.contactoApellidos || profile?.apellidos || '',
      contactoDni: prev.contactoDni || profile?.dni || '',
      contactoCargo: prev.contactoCargo || profile?.cargo || '',
      contactoTels: prev.contactoTels || profile?.telefono || '',
      contactoEmail: prev.contactoEmail || profile?.email || user?.email || ''
    }))
  }, [profile, user])

  const bank = bankConfig || {}
  const terms = (bank.terminosCondiciones || '').trim()
  const hasTerms = terms.length > 0
  const isIndividual = activePlan === 'individual'
  const individualPlan = getAffiliationPlan(affiliationConfig, 'individual')
  const corporatePlan = getAffiliationPlan(affiliationConfig, 'corporativo')
  const plan = isIndividual ? individualPlan : corporatePlan
  const introTitulo = affiliationConfig?.introTitulo || AFFILIATION_DEFAULTS.introTitulo
  const introTexto = affiliationConfig?.introTexto || AFFILIATION_DEFAULTS.introTexto
  const submitLabel = busy
    ? 'Procesando…'
    : !user
      ? 'Inicia sesión para enviar'
      : isIndividual
        ? 'Enviar solicitud individual'
        : 'Enviar solicitud corporativa'

  const handleFile = (setter) => (field) => async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setMsg('')
    try {
      const stored = await fileToStorable(file, 2000)
      setter((prev) => ({ ...prev, [field]: stored }))
    } catch (err) {
      setMsg(
        err.message === 'too-large'
          ? 'El archivo supera el máximo permitido de 4 MB.'
          : 'Formato no permitido. Usa una imagen JPG/PNG o un PDF.'
      )
    }
  }

  const switchPlan = (plan) => {
    setActivePlan(plan)
    setViewMode('info')
    setMsg('')
    setOkMsg('')
    setAcceptTerms(false)
  }

  const submit = async (plan, asDraft = false) => {
    const individual = plan === 'individual'
    const data = individual ? formInd : formCorp

    if (!user) {
      setMsg('Debes iniciar sesión para enviar tu solicitud de afiliación.')
      return
    }
    if (!asDraft) {
      if (!data.pagoFile) {
        setMsg('Adjunta el comprobante de pago para poder enviar tu solicitud.')
        return
      }
      if (hasTerms && !acceptTerms) {
        setMsg('Debes leer y aceptar los términos y condiciones de afiliación.')
        return
      }
    }

    setBusy(true)
    setMsg('')
    setOkMsg('')

    try {
      const now = Date.now()
      const estado = asDraft ? 'borrador' : 'pendiente'
      const facturaId = asDraft ? null : `AF_${user.uid}`
      const monto = Number(plan.precioMonto) || 0
      const metodoPago = data.metodoPago || 'transfer'
      const proof = data.pagoFile && typeof data.pagoFile === 'object' ? data.pagoFile.dataUrl : data.pagoFile
      const proofName =
        data.pagoFile && typeof data.pagoFile === 'object'
          ? data.pagoFile.name
          : 'Comprobante de afiliación'
      const proofType =
        data.pagoFile && typeof data.pagoFile === 'object' ? data.pagoFile.type : ''

      const payload = {
        id: `af_${individual ? 'ind' : 'corp'}_${now}`,
        uid: user.uid,
        tipo: individual ? 'individual' : 'corporativo',
        ...data,
        metodoPago,
        monto,
        facturaId,
        aceptaTerminos: hasTerms ? acceptTerms : false,
        estado,
        fecha: now
      }

      await set(ref(db, `${DB_ROOT}/afiliaciones_solicitudes/${user.uid}`), payload)
      await set(ref(db, `${DB_ROOT}/users/${user.uid}/solicitudAfiliacion`), {
        tipo: payload.tipo,
        estado,
        fecha: now,
        facturaId,
        monto
      })

      // La factura de afiliación aparece en Facturación / Pagos y se completa
      // automáticamente cuando el admin aprueba la solicitud.
      if (!asDraft) {
        await set(ref(db, `${DB_ROOT}/facturas/${user.uid}/${facturaId}`), {
          numero: `AF-${now.toString().slice(-6)}`,
          facturaId,
          concepto: `Afiliación ${individual ? 'Individual' : 'Corporativa'}`,
          tipo: 'afiliacion',
          plan: payload.tipo,
          monto,
          metodo: metodoPago,
          estado: 'pendiente',
          fecha: now,
          comprobante: proof,
          comprobanteNombre: proofName,
          comprobanteTipo: proofType,
          comprobanteFecha: now
        })
      }

      if (asDraft) {
        setOkMsg('Borrador guardado correctamente. Puedes completarlo y enviarlo cuando quieras.')
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      console.error(err)
      const denied = err?.code === 'PERMISSION_DENIED' || /permission/i.test(err?.message || '')
      setMsg(
        denied
          ? 'El sistema todavía no tiene habilitado el buzón de afiliaciones. Escríbenos a informacion@avgh.org.ve para completar tu solicitud.'
          : 'No pudimos procesar la solicitud. Revisa tu conexión e inténtalo de nuevo.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="page aff-page">
        <div className="aff-success">
          <FaCircleCheck className="aff-success-icon" />
          <h1>¡Solicitud de afiliación enviada!</h1>
          <p>
            Hemos recibido los datos de tu afiliación. La Junta Directiva revisará tu solicitud y te notificará cuando
            sea validada.
          </p>
          <div className="aff-success-actions">
            <Link to="/perfil" className="btn btn-primary">
              Ir a mi perfil
            </Link>
            <Link to="/" className="btn btn-outline">
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page aff-page">
      <div className="page-head aff-page-head">
        <Link to="/" className="btn-icon" aria-label="Volver al inicio">
          <FaArrowLeft />
        </Link>
        <div className="page-head-text">
          <h1>Afiliaciones AVGH</h1>
          <p className="page-sub">Únete a la red de profesionales de Gestión Humana de Venezuela</p>
        </div>
      </div>

      {!user && (
        <div className="aff-login-banner">
          <FaLock />
          <div>
            <strong>Inicia sesión para enviar tu solicitud</strong>
            <p>Puedes revisar los planes y requisitos ahora. Para guardar o enviar la planilla necesitas una cuenta.</p>
          </div>
          <Link to="/" className="btn btn-primary btn-sm">
            Iniciar sesión
          </Link>
        </div>
      )}

      <section className="aff-hero">
        <span className="aff-hero-badge">
          <FaIdCard /> Afiliación AVGH
        </span>
        <h2>{introTitulo}</h2>
        <p>{introTexto}</p>
      </section>

      <div className="aff-tabs" role="tablist" aria-label="Tipo de afiliación">
        <button
          type="button"
          role="tab"
          aria-selected={isIndividual}
          className={`aff-tab ${isIndividual ? 'is-active' : ''}`}
          onClick={() => switchPlan('individual')}
        >
          <span className="aff-tab-icon">
            <FaUser />
          </span>
          <span className="aff-tab-text">
            <strong>{individualPlan.titulo}</strong>
            <small>{individualPlan.subtitulo}</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isIndividual}
          className={`aff-tab ${!isIndividual ? 'is-active' : ''}`}
          onClick={() => switchPlan('corporativo')}
        >
          <span className="aff-tab-icon">
            <FaBuilding />
          </span>
          <span className="aff-tab-text">
            <strong>{corporatePlan.titulo}</strong>
            <small>{corporatePlan.subtitulo}</small>
          </span>
        </button>
      </div>

      <section className="aff-plan-card">
        <header className="aff-plan-head">
          <div className="aff-plan-heading">
            <span className="aff-eyebrow">{isIndividual ? 'Plan individual' : 'Plan corporativo premium'}</span>
            <h2>{plan.titulo}</h2>
            <p>{plan.descripcion}</p>
          </div>
          <div className="aff-plan-price">
            <small>{plan.precioEtiqueta}</small>
            <strong>{plan.precio}</strong>
            <span>{plan.precioNota}</span>
          </div>
        </header>

        <div className="aff-subtabs" role="tablist" aria-label="Secciones de la afiliación">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'info'}
            className={`aff-subtab ${viewMode === 'info' ? 'is-active' : ''}`}
            onClick={() => setViewMode('info')}
          >
            Beneficios
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'requisitos'}
            className={`aff-subtab ${viewMode === 'requisitos' ? 'is-active' : ''}`}
            onClick={() => setViewMode('requisitos')}
          >
            <FaBuildingColumns /> Requisitos y pago
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'form'}
            className={`aff-subtab ${viewMode === 'form' ? 'is-active' : ''}`}
            onClick={() => setViewMode('form')}
          >
            <FaCheck /> Llenar planilla
          </button>
        </div>

        <div className="aff-plan-body">
          {viewMode === 'info' && (
            <>
              <h3 className="aff-section-title">Beneficios destacados</h3>
              {plan.beneficios.length > 0 ? (
                <BenefitsList items={plan.beneficios} />
              ) : (
                <p className="aff-muted">El administrador todavía no ha publicado los beneficios de este plan.</p>
              )}
              <div className="aff-actions">
                <button type="button" className="btn btn-outline" onClick={() => setViewMode('requisitos')}>
                  Ver requisitos y datos de pago
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setViewMode('form')}>
                  {isIndividual ? 'Solicitar afiliación individual' : 'Solicitar afiliación corporativa'}
                </button>
              </div>
            </>
          )}

          {viewMode === 'requisitos' && (
            <>
              <h3 className="aff-section-title">Documentos requeridos</h3>
              {plan.requisitos.length > 0 ? (
                <ul className="aff-docs">
                  {plan.requisitos.map((doc) => (
                    <li key={doc}>
                      <FaCheck /> {doc}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="aff-muted">El administrador todavía no ha publicado los requisitos de este plan.</p>
              )}

              <BankDetails bank={bank} loading={loadingBank} />
              <TermsBox terms={terms} />

              <div className="aff-actions">
                <button type="button" className="btn btn-outline" onClick={() => setViewMode('info')}>
                  Volver a beneficios
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setViewMode('form')}>
                  Ir a la planilla de registro
                </button>
              </div>
            </>
          )}

          {viewMode === 'form' && (
            <form
              className="aff-form"
              onSubmit={(e) => {
                e.preventDefault()
                submit(activePlan, false)
              }}
            >
              <div className="aff-form-title">
                <h3>{isIndividual ? 'Planilla de afiliación individual' : 'Planilla de afiliación corporativa'}</h3>
                <span>2026</span>
              </div>

              {isIndividual ? (
                <>
                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>1</span> Datos personales
                    </h4>
                    <div className="field-row">
                      <TextField label="Nombres" value={formInd.nombres} onChange={(v) => setFormInd((p) => ({ ...p, nombres: v }))} required />
                      <TextField label="Apellidos" value={formInd.apellidos} onChange={(v) => setFormInd((p) => ({ ...p, apellidos: v }))} required />
                    </div>
                    <div className="field-row">
                      <TextField label="Lugar de nacimiento" value={formInd.lugarNacimiento} onChange={(v) => setFormInd((p) => ({ ...p, lugarNacimiento: v }))} />
                      <TextField label="Fecha de nacimiento" type="date" value={formInd.fechaNacimiento} onChange={(v) => setFormInd((p) => ({ ...p, fechaNacimiento: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Nacionalidad" value={formInd.nacionalidad} onChange={(v) => setFormInd((p) => ({ ...p, nacionalidad: v }))} />
                      <TextField label="Cédula de identidad" value={formInd.dni} onChange={(v) => setFormInd((p) => ({ ...p, dni: v }))} required />
                    </div>
                    <TextField label="Dirección de habitación" value={formInd.direccionHabitacion} onChange={(v) => setFormInd((p) => ({ ...p, direccionHabitacion: v }))} />
                    <div className="field-row">
                      <TextField label="Ciudad" value={formInd.ciudad} onChange={(v) => setFormInd((p) => ({ ...p, ciudad: v }))} />
                      <TextField label="Estado" value={formInd.estado} onChange={(v) => setFormInd((p) => ({ ...p, estado: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Teléfono fijo" value={formInd.telefonos} onChange={(v) => setFormInd((p) => ({ ...p, telefonos: v }))} />
                      <TextField label="Teléfono móvil" value={formInd.movil} onChange={(v) => setFormInd((p) => ({ ...p, movil: v }))} />
                    </div>
                    <TextField label="Correo electrónico" type="email" value={formInd.email} onChange={(v) => setFormInd((p) => ({ ...p, email: v }))} required />
                  </section>

                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>2</span> Estudios realizados
                    </h4>
                    <div className="field-row">
                      <TextField label="Título obtenido" value={formInd.titulo1} onChange={(v) => setFormInd((p) => ({ ...p, titulo1: v }))} />
                      <TextField label="Institución" value={formInd.institucion1} onChange={(v) => setFormInd((p) => ({ ...p, institucion1: v }))} />
                    </div>
                    <TextField label="Año de graduación" placeholder="Ej. 2021" value={formInd.fecha1} onChange={(v) => setFormInd((p) => ({ ...p, fecha1: v }))} />
                    <div className="field-row">
                      <TextField label="Segundo título (opcional)" value={formInd.titulo2} onChange={(v) => setFormInd((p) => ({ ...p, titulo2: v }))} />
                      <TextField label="Institución" value={formInd.institucion2} onChange={(v) => setFormInd((p) => ({ ...p, institucion2: v }))} />
                    </div>
                    <TextField label="Año de graduación" placeholder="Ej. 2024" value={formInd.fecha2} onChange={(v) => setFormInd((p) => ({ ...p, fecha2: v }))} />
                  </section>

                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>3</span> Datos laborales
                    </h4>
                    <TextField label="Empresa donde labora" value={formInd.empresa} onChange={(v) => setFormInd((p) => ({ ...p, empresa: v }))} />
                    <TextField label="Dirección laboral" value={formInd.direccionEmpresa} onChange={(v) => setFormInd((p) => ({ ...p, direccionEmpresa: v }))} />
                    <div className="field-row">
                      <TextField label="Teléfono de la empresa" value={formInd.telefonoEmpresa} onChange={(v) => setFormInd((p) => ({ ...p, telefonoEmpresa: v }))} />
                      <TextField label="Correo de la empresa" type="email" value={formInd.emailEmpresa} onChange={(v) => setFormInd((p) => ({ ...p, emailEmpresa: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Sector económico" value={formInd.sectorEconomico} onChange={(v) => setFormInd((p) => ({ ...p, sectorEconomico: v }))} />
                      <TextField label="Cargo" value={formInd.cargo} onChange={(v) => setFormInd((p) => ({ ...p, cargo: v }))} />
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>1</span> Información de la empresa
                    </h4>
                    <TextField label="Razón social" value={formCorp.razonSocial} onChange={(v) => setFormCorp((p) => ({ ...p, razonSocial: v }))} required />
                    <div className="field-row">
                      <TextField label="RIF" placeholder="J-12345678-9" value={formCorp.rif} onChange={(v) => setFormCorp((p) => ({ ...p, rif: v }))} required />
                      <SelectField
                        label="Sector empresarial"
                        value={formCorp.sector}
                        onChange={(v) => setFormCorp((p) => ({ ...p, sector: v }))}
                        options={['Banca', 'Industria', 'Petróleo', 'Consultoría', 'Salud', 'Informática', 'Metalúrgico', 'Otro']}
                      />
                    </div>
                    {formCorp.sector === 'Otro' && (
                      <TextField label="Especifique el sector" value={formCorp.sectorOtro} onChange={(v) => setFormCorp((p) => ({ ...p, sectorOtro: v }))} />
                    )}
                    <TextField label="Dirección fiscal" value={formCorp.direccion} onChange={(v) => setFormCorp((p) => ({ ...p, direccion: v }))} />
                    <div className="field-row">
                      <TextField label="Ciudad" value={formCorp.ciudad} onChange={(v) => setFormCorp((p) => ({ ...p, ciudad: v }))} />
                      <TextField label="Estado" value={formCorp.estado} onChange={(v) => setFormCorp((p) => ({ ...p, estado: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Teléfonos" value={formCorp.telefonos} onChange={(v) => setFormCorp((p) => ({ ...p, telefonos: v }))} />
                      <TextField label="Correo corporativo" type="email" value={formCorp.emailCorp} onChange={(v) => setFormCorp((p) => ({ ...p, emailCorp: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Sitio web" value={formCorp.web} onChange={(v) => setFormCorp((p) => ({ ...p, web: v }))} />
                      <TextField label="Redes sociales" value={formCorp.redes} onChange={(v) => setFormCorp((p) => ({ ...p, redes: v }))} />
                    </div>
                  </section>

                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>2</span> Contacto de Recursos Humanos
                    </h4>
                    <div className="field-row">
                      <TextField label="Nombres" value={formCorp.contactoNombres} onChange={(v) => setFormCorp((p) => ({ ...p, contactoNombres: v }))} />
                      <TextField label="Apellidos" value={formCorp.contactoApellidos} onChange={(v) => setFormCorp((p) => ({ ...p, contactoApellidos: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Cédula" value={formCorp.contactoDni} onChange={(v) => setFormCorp((p) => ({ ...p, contactoDni: v }))} />
                      <TextField label="Cargo" value={formCorp.contactoCargo} onChange={(v) => setFormCorp((p) => ({ ...p, contactoCargo: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Departamento" value={formCorp.contactoDept} onChange={(v) => setFormCorp((p) => ({ ...p, contactoDept: v }))} />
                      <TextField label="Teléfonos" value={formCorp.contactoTels} onChange={(v) => setFormCorp((p) => ({ ...p, contactoTels: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Teléfono móvil" value={formCorp.contactoMovil} onChange={(v) => setFormCorp((p) => ({ ...p, contactoMovil: v }))} />
                      <TextField label="Correo electrónico" type="email" value={formCorp.contactoEmail} onChange={(v) => setFormCorp((p) => ({ ...p, contactoEmail: v }))} />
                    </div>
                  </section>

                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>3</span> Representante legal
                    </h4>
                    <div className="field-row">
                      <TextField label="Nombres" value={formCorp.gerenteNombres} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteNombres: v }))} />
                      <TextField label="Apellidos" value={formCorp.gerenteApellidos} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteApellidos: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Cédula" value={formCorp.gerenteDni} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteDni: v }))} />
                      <TextField label="Cargo" value={formCorp.gerenteCargo} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteCargo: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Teléfonos" value={formCorp.gerenteTels} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteTels: v }))} />
                      <TextField label="Teléfono móvil" value={formCorp.gerenteMovil} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteMovil: v }))} />
                    </div>
                    <TextField label="Correo electrónico" type="email" value={formCorp.gerenteEmail} onChange={(v) => setFormCorp((p) => ({ ...p, gerenteEmail: v }))} />
                  </section>

                  <section className="aff-form-section">
                    <h4 className="aff-form-section-title">
                      <span>4</span> Administrador del portal
                    </h4>
                    <div className="field-row">
                      <TextField label="Nombres" value={formCorp.adminNombres} onChange={(v) => setFormCorp((p) => ({ ...p, adminNombres: v }))} />
                      <TextField label="Apellidos" value={formCorp.adminApellidos} onChange={(v) => setFormCorp((p) => ({ ...p, adminApellidos: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Cédula" value={formCorp.adminDni} onChange={(v) => setFormCorp((p) => ({ ...p, adminDni: v }))} />
                      <TextField label="Cargo" value={formCorp.adminCargo} onChange={(v) => setFormCorp((p) => ({ ...p, adminCargo: v }))} />
                    </div>
                    <div className="field-row">
                      <TextField label="Teléfonos" value={formCorp.adminTels} onChange={(v) => setFormCorp((p) => ({ ...p, adminTels: v }))} />
                      <TextField label="Teléfono móvil" value={formCorp.adminMovil} onChange={(v) => setFormCorp((p) => ({ ...p, adminMovil: v }))} />
                    </div>
                    <TextField label="Correo electrónico" type="email" value={formCorp.adminEmail} onChange={(v) => setFormCorp((p) => ({ ...p, adminEmail: v }))} />
                  </section>
                </>
              )}

              <section className="aff-form-section">
                <h4 className="aff-form-section-title">
                  <span>{isIndividual ? '4' : '5'}</span> Pago y recaudos
                </h4>
                <BankDetails bank={bank} loading={loadingBank} />

                <label className="field-label">
                  <span>Método de pago utilizado</span>
                  <select
                    className="input"
                    value={isIndividual ? formInd.metodoPago : formCorp.metodoPago}
                    onChange={(event) => {
                      const value = event.target.value
                      if (isIndividual) {
                        setFormInd((prev) => ({ ...prev, metodoPago: value }))
                      } else {
                        setFormCorp((prev) => ({ ...prev, metodoPago: value }))
                      }
                    }}
                  >
                    <option value="transfer">Transferencia bancaria</option>
                    <option value="mobile">Pago móvil</option>
                    <option value="zelle">Zelle</option>
                    <option value="binance">Binance</option>
                    <option value="cash">Efectivo / otro</option>
                  </select>
                </label>

                <div className="file-upload-grid">
                  {isIndividual ? (
                    <>
                      <FileField label="Copia de la cédula" value={formInd.cedulaFile} onChange={handleFile(setFormInd)('cedulaFile')} />
                      <FileField label="Currículo Vitae" value={formInd.cvFile} onChange={handleFile(setFormInd)('cvFile')} />
                      <FileField label="Referencia personal 1" value={formInd.ref1File} onChange={handleFile(setFormInd)('ref1File')} />
                      <FileField label="Referencia personal 2" value={formInd.ref2File} onChange={handleFile(setFormInd)('ref2File')} />
                      <div className="full-width">
                        <FileField label="Comprobante de pago (obligatorio)" value={formInd.pagoFile} onChange={handleFile(setFormInd)('pagoFile')} />
                      </div>
                    </>
                  ) : (
                    <>
                      <FileField label="Copia del RIF actualizado" value={formCorp.rifFile} onChange={handleFile(setFormCorp)('rifFile')} />
                      <FileField label="Copia del Registro Mercantil" value={formCorp.mercantilFile} onChange={handleFile(setFormCorp)('mercantilFile')} />
                      <div className="full-width">
                        <FileField label="Comprobante de pago (obligatorio)" value={formCorp.pagoFile} onChange={handleFile(setFormCorp)('pagoFile')} />
                      </div>
                    </>
                  )}
                </div>

                <TermsBox terms={terms} />

                {hasTerms && (
                  <label className="checkbox aff-terms-check">
                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                    <span>He leído y acepto los términos y condiciones de afiliación de la AVGH.</span>
                  </label>
                )}
              </section>

              {msg && <p className="form-error">{msg}</p>}
              {okMsg && <p className="form-success">{okMsg}</p>}

              <div className="aff-form-actions">
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => submit(activePlan, true)}>
                  Guardar borrador
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || !user}>
                  {submitLabel}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
