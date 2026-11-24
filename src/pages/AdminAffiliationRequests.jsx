import { useMemo, useState } from 'react'
import {
  FaIdCard,
  FaUser,
  FaBuilding,
  FaCircleCheck,
  FaCircleXmark,
  FaFilePdf,
  FaImage,
  FaEye,
  FaCheck,
  FaXmark,
  FaClock
} from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import {
  useAffiliationRequests,
  approveAffiliationRequest,
  rejectAffiliationRequest
} from '../data/useData'
import { formatDate } from '../components/ActivityCard'
import { CURRENCY } from '../config'

const INDIVIDUAL_FIELDS = [
  ['nombres', 'Nombres'],
  ['apellidos', 'Apellidos'],
  ['lugarNacimiento', 'Lugar de nacimiento'],
  ['fechaNacimiento', 'Fecha de nacimiento'],
  ['nacionalidad', 'Nacionalidad'],
  ['dni', 'Cédula de identidad'],
  ['direccionHabitacion', 'Dirección de habitación'],
  ['ciudad', 'Ciudad'],
  ['estado', 'Estado'],
  ['telefonos', 'Teléfono fijo'],
  ['movil', 'Teléfono móvil'],
  ['email', 'Correo electrónico'],
  ['titulo1', 'Título obtenido'],
  ['institucion1', 'Institución'],
  ['fecha1', 'Año de graduación'],
  ['titulo2', 'Segundo título'],
  ['institucion2', 'Institución (2do título)'],
  ['fecha2', 'Año de graduación (2do título)'],
  ['empresa', 'Empresa donde labora'],
  ['direccionEmpresa', 'Dirección laboral'],
  ['telefonoEmpresa', 'Teléfono de la empresa'],
  ['emailEmpresa', 'Correo de la empresa'],
  ['sectorEconomico', 'Sector económico'],
  ['cargo', 'Cargo']
]

const CORPORATE_FIELDS = [
  ['razonSocial', 'Razón social'],
  ['rif', 'RIF'],
  ['sector', 'Sector empresarial'],
  ['sectorOtro', 'Sector (otro)'],
  ['direccion', 'Dirección fiscal'],
  ['ciudad', 'Ciudad'],
  ['estado', 'Estado'],
  ['telefonos', 'Teléfonos'],
  ['emailCorp', 'Correo corporativo'],
  ['web', 'Sitio web'],
  ['redes', 'Redes sociales'],
  ['contactoNombres', 'Contacto RRHH - Nombres'],
  ['contactoApellidos', 'Contacto RRHH - Apellidos'],
  ['contactoDni', 'Contacto RRHH - Cédula'],
  ['contactoCargo', 'Contacto RRHH - Cargo'],
  ['contactoDept', 'Contacto RRHH - Departamento'],
  ['contactoTels', 'Contacto RRHH - Teléfonos'],
  ['contactoMovil', 'Contacto RRHH - Móvil'],
  ['contactoEmail', 'Contacto RRHH - Correo'],
  ['gerenteNombres', 'Representante legal - Nombres'],
  ['gerenteApellidos', 'Representante legal - Apellidos'],
  ['gerenteDni', 'Representante legal - Cédula'],
  ['gerenteCargo', 'Representante legal - Cargo'],
  ['gerenteTels', 'Representante legal - Teléfonos'],
  ['gerenteMovil', 'Representante legal - Móvil'],
  ['gerenteEmail', 'Representante legal - Correo'],
  ['adminNombres', 'Administrador del portal - Nombres'],
  ['adminApellidos', 'Administrador del portal - Apellidos'],
  ['adminDni', 'Administrador del portal - Cédula'],
  ['adminCargo', 'Administrador del portal - Cargo'],
  ['adminTels', 'Administrador del portal - Teléfonos'],
  ['adminMovil', 'Administrador del portal - Móvil'],
  ['adminEmail', 'Administrador del portal - Correo']
]

const INDIVIDUAL_FILES = [
  ['cedulaFile', 'Copia de la cédula'],
  ['cvFile', 'Currículo Vitae'],
  ['ref1File', 'Referencia personal 1'],
  ['ref2File', 'Referencia personal 2'],
  ['pagoFile', 'Comprobante de pago']
]

const CORPORATE_FILES = [
  ['rifFile', 'Copia del RIF'],
  ['mercantilFile', 'Registro Mercantil'],
  ['pagoFile', 'Comprobante de pago']
]

const PAYMENT_LABELS = {
  transfer: 'Transferencia',
  mobile: 'Pago móvil',
  zelle: 'Zelle',
  binance: 'Binance',
  cash: 'Efectivo',
  card: 'Tarjeta'
}

function requestName(request) {
  if (request.tipo === 'corporativo') {
    return request.razonSocial || request.nombreEmpresa || request.user?.nombreEmpresa || request.user?.email || 'Empresa'
  }
  return (
    `${request.nombres || request.user?.nombres || ''} ${request.apellidos || request.user?.apellidos || ''}`.trim() ||
    request.user?.email ||
    'Solicitante'
  )
}

function planLabel(tipo) {
  return tipo === 'corporativo' ? 'Corporativa' : 'Individual'
}

function fileUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.dataUrl || ''
}

function fileName(value) {
  if (!value) return 'Archivo'
  if (typeof value === 'string') return 'Archivo adjunto'
  return value.name || 'Archivo adjunto'
}

function StatusBadge({ estado }) {
  if (estado === 'aprobada') {
    return <span className="badge badge-Confirmada"><FaCircleCheck /> Aprobada</span>
  }
  if (estado === 'rechazada') {
    return <span className="badge badge-Rechazada"><FaCircleXmark /> Rechazada</span>
  }
  if (estado === 'borrador') {
    return <span className="badge badge-pendiente"><FaClock /> Borrador</span>
  }
  return <span className="badge badge-pendiente"><FaClock /> Pendiente</span>
}

export default function AdminAffiliationRequests() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { items, loading, error } = useAffiliationRequests()
  const [filter, setFilter] = useState('pendiente')
  const [sortBy, setSortBy] = useState('nombre-asc')
  const [selectedUid, setSelectedUid] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const selected = useMemo(() => items.find((item) => item.uid === selectedUid) || null, [items, selectedUid])

  const counts = useMemo(
    () => ({
      pendiente: items.filter((item) => item.estado === 'pendiente' || item.estado === 'borrador').length,
      aprobada: items.filter((item) => item.estado === 'aprobada').length,
      rechazada: items.filter((item) => item.estado === 'rechazada').length,
      total: items.length
    }),
    [items]
  )

  const filtered = useMemo(() => {
    let out = items
    if (filter === 'pendiente') out = items.filter((item) => item.estado === 'pendiente' || item.estado === 'borrador')
    else if (filter !== 'all') out = items.filter((item) => item.estado === filter)
    const nameOf = (i) => `${i.user?.nombres || ''} ${i.user?.apellidos || ''} ${i.nombreEmpresa || i.razonSocial || i.email || ''}`.trim()
    out = [...out].sort((a, b) => {
      if (sortBy === 'nombre-desc') return nameOf(b).localeCompare(nameOf(a), 'es')
      if (sortBy === 'recientes') return (b.fecha || b.fechaRegistro || 0) - (a.fecha || a.fechaRegistro || 0)
      return nameOf(a).localeCompare(nameOf(b), 'es')
    })
    return out
  }, [items, filter, sortBy])

  const openRequest = (item) => {
    setSelectedUid(item.uid)
    setNote(item.notaAdmin || '')
    setMsg('')
    setErr('')
  }

  const approve = async () => {
    if (!selected) return
    if (
      !window.confirm(
        `¿Aprobar la afiliación ${planLabel(selected.tipo).toLowerCase()} de ${requestName(selected)}? ` +
          'El usuario quedará como afiliado activo y la factura se marcará como completada.'
      )
    ) {
      return
    }
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      await approveAffiliationRequest({
        uid: selected.uid,
        request: selected,
        adminUid: user?.uid,
        nota: note.trim()
      })
      setMsg('✅ Solicitud aprobada. El afiliado y la factura quedaron sincronizados.')
      setSelectedUid(null)
      setNote('')
    } catch (error) {
      console.error(error)
      setErr('No se pudo aprobar la solicitud. Revisa la conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!selected) return
    const reason = note.trim() || window.prompt('Motivo del rechazo (opcional):') || ''
    if (!window.confirm(`¿Rechazar la solicitud de ${requestName(selected)}? La factura quedará rechazada.`)) {
      return
    }
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      await rejectAffiliationRequest({
        uid: selected.uid,
        request: selected,
        adminUid: user?.uid,
        nota: reason
      })
      setMsg('Solicitud rechazada. El solicitante podrá corregir y enviar de nuevo.')
      setSelectedUid(null)
      setNote('')
    } catch (error) {
      console.error(error)
      setErr('No se pudo rechazar la solicitud. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const fields = selected?.tipo === 'corporativo' ? CORPORATE_FIELDS : INDIVIDUAL_FIELDS
  const files = selected?.tipo === 'corporativo' ? CORPORATE_FILES : INDIVIDUAL_FILES

  if (error) {
    return (
      <section className="panel">
        <div className="panel-head">
          <FaIdCard />
          <h3>Solicitudes de afiliación</h3>
        </div>
        <p className="form-error">{t('admin.errorSave')}</p>
      </section>
    )
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaIdCard />
            <h3>Solicitudes de afiliación ({counts.pendiente} pendientes)</h3>
          </div>
          <div className="btn-row">
            {[
              ['pendiente', `Pendientes (${counts.pendiente})`],
              ['aprobada', `Aprobadas (${counts.aprobada})`],
              ['rechazada', `Rechazadas (${counts.rechazada})`],
              ['all', `Todas (${counts.total})`]
            ].map(([value, label]) => (
              <button
                key={value}
                className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
            <select
              className="input"
              style={{ maxWidth: '190px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Ordenar solicitudes de afiliación"
            >
              <option value="nombre-asc">Orden: Nombre A-Z</option>
              <option value="nombre-desc">Orden: Nombre Z-A</option>
              <option value="recientes">Orden: Más recientes</option>
            </select>
          </div>
        </div>

        <p className="auth-hint">
          Revisa los recaudos y el comprobante de pago. Al aprobar, el usuario pasa a la sección{' '}
          <strong>Afiliados</strong> con el plan seleccionado y la factura se completa en{' '}
          <strong>Facturación / Pagos</strong>.
        </p>

        {msg && <p className="form-success">{msg}</p>}
        {err && <p className="form-error">{err}</p>}

        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="panel-empty">
            <p>
              {filter === 'pendiente'
                ? 'No hay solicitudes de afiliación pendientes por revisar.'
                : 'No hay solicitudes con este filtro.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Solicitante</th>
                  <th>Plan</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Comprobante</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const proof = fileUrl(item.pagoFile || item.factura?.comprobante)
                  return (
                    <tr key={item.uid}>
                      <td>
                        <div className="admin-student">
                          <span className="admin-thumb admin-thumb-initial">
                            {item.tipo === 'corporativo' ? <FaBuilding /> : <FaUser />}
                          </span>
                          <div>
                            <strong>{requestName(item)}</strong>
                            <span className="list-sub">
                              {item.email || item.emailCorp || item.user?.email || item.uid}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-type">
                          {item.tipo === 'corporativo' ? <FaBuilding /> : <FaUser />} {planLabel(item.tipo)}
                        </span>
                      </td>
                      <td>{formatDate(item.fecha, lang)}</td>
                      <td><StatusBadge estado={item.estado} /></td>
                      <td>
                        {proof ? (
                          <a
                            href={proof}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="receipt-ok"
                            title="Ver comprobante"
                          >
                            ✓
                          </a>
                        ) : (
                          <span className="receipt-no">—</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openRequest(item)}>
                          <FaEye /> Revisar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="panel admin-detail">
          <div className="admin-detail-head">
            <h3>Revisión de afiliación — {requestName(selected)}</h3>
            <button className="btn-icon" onClick={() => setSelectedUid(null)} aria-label="Cerrar">
              <FaXmark />
            </button>
          </div>

          <div className="admin-grid">
            <div className="admin-section">
              <h4>Datos de la solicitud</h4>
              <ul className="admin-list">
                <li><strong>Plan solicitado:</strong> {planLabel(selected.tipo)}</li>
                <li><strong>Estado:</strong> <StatusBadge estado={selected.estado} /></li>
                <li><strong>Fecha:</strong> {formatDate(selected.fecha, lang)}</li>
                <li><strong>Correo de la cuenta:</strong> {selected.user?.email || selected.email || selected.emailCorp || 'No indicado'}</li>
                <li><strong>Método de pago:</strong> {PAYMENT_LABELS[selected.metodoPago] || selected.metodoPago || 'No indicado'}</li>
                <li>
                  <strong>Monto para facturación:</strong>{' '}
                  {Number(selected.monto) > 0 ? `${CURRENCY}${selected.monto}` : 'Por cotizar / sin monto'}
                </li>
                <li><strong>Términos aceptados:</strong> {selected.aceptaTerminos ? 'Sí' : 'No'}</li>
                {selected.facturaId && <li><strong>Factura:</strong> {selected.factura?.numero || selected.facturaId}</li>}
                {selected.factura?.estado && <li><strong>Estado de factura:</strong> {selected.factura.estado}</li>}
                {selected.notaAdmin && <li><strong>Nota anterior:</strong> {selected.notaAdmin}</li>}
              </ul>
            </div>

            <div className="admin-section">
              <h4>Recaudos cargados</h4>
              <ul className="admin-list">
                {files.map(([key, label]) => {
                  const value = selected[key]
                  const url = fileUrl(value)
                  const pdf = url.startsWith('data:application/pdf')
                  return (
                    <li key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong>{label}:</strong>{' '}
                      {url ? (
                        <>
                          {pdf ? <FaFilePdf /> : <FaImage />}
                          <span>{fileName(value)}</span>
                          <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noopener noreferrer">
                            Ver archivo
                          </a>
                        </>
                      ) : (
                        <span className="list-sub">No cargado</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <div className="admin-section" style={{ marginTop: '16px' }}>
            <h4>Datos declarados por el solicitante</h4>
            <ul className="admin-list admin-aff-data">
              {fields.map(([key, label]) =>
                selected[key] ? (
                  <li key={key}>
                    <strong>{label}:</strong> {String(selected[key])}
                  </li>
                ) : null
              )}
            </ul>
          </div>

          <label className="field-label" style={{ marginTop: '16px' }}>
            <span>Nota interna / motivo (opcional)</span>
            <textarea
              className="input"
              rows="2"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Verificado el pago en el banco. / Falta copia del RIF."
            />
          </label>

          <div className="btn-row" style={{ marginTop: '14px' }}>
            <button className="btn btn-primary" disabled={busy || selected.estado === 'aprobada'} onClick={approve}>
              <FaCheck /> {busy ? 'Procesando…' : 'Aprobar afiliación'}
            </button>
            <button
              className="btn btn-danger-outline"
              disabled={busy || selected.estado === 'rechazada'}
              onClick={reject}
            >
              <FaCircleXmark /> Rechazar
            </button>
          </div>
        </section>
      )}
    </>
  )
}
