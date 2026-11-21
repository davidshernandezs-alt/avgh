import { useEffect, useRef, useState } from 'react'
import { FaXmark, FaPrint, FaEnvelope, FaCircleCheck, FaAward } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { localize } from '../utils/localized'
import { formatDate } from '../components/ActivityCard'
import { useAuth } from '../auth/AuthContext'
import { saveUserCertificate } from '../data/useData'
import { downloadCertificatePDF } from '../utils/certificatePdf'
import firma1Url from '../assets/firma-nombre-1.png'
import firma2Url from '../assets/firma-nombre-2.png'
import afiliadoLogo1Url from '../assets/afiliado-logo-1.png'
import afiliadoLogo2Url from '../assets/afiliado-logo-2.png'

const EMPTY_CERT = {
  nombre: '',
  cedula: '',
  titulo: '',
  contenido: '',
  objetivo: '',
  facilitador: '',
  fecha: '',
  duracion: '',
  modalidad: '',
  firma1Nombre: 'Emilse Plata',
  firma1Cargo: 'Directora Ejecutiva AVGH',
  firma2Nombre: 'Almer Bracamonte',
  firma2Cargo: 'Vicepresidente - AVGH',
  firma1Imagen: firma1Url,
  firma2Imagen: firma2Url,
  facilitadorImagen: '',
  afiliadoLogo1: afiliadoLogo1Url,
  afiliadoLogo2: afiliadoLogo2Url,
  afiliadoLogo3: '',
  afiliadoLogo4: ''
}

function SignatureUpload({ label, value, onChange }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input type="file" accept="image/*" className="input" onChange={(e) => onChange(e.target.files?.[0])} />
      {value && (
        <span className="firma-preview">
          <img src={value} alt="Vista previa de la firma" />
          <button type="button" className="btn btn-sm btn-outline" onClick={() => onChange(null)}>Quitar</button>
        </span>
      )}
    </label>
  )
}

function SignatureBlock({ name, role, image }) {
  return (
    <div className="certificate-signature">
      <div className="certificate-signature-line">
        {image
          ? <img src={image} alt={name} className="certificate-firma-img" />
          : <span className="certificate-signature-noimage" aria-hidden="true" />}
      </div>
      <div className="certificate-signature-name">{name}</div>
      <div className="certificate-signature-role">{role}</div>
    </div>
  )
}

export default function CertificateModal({ user, insc, act, mode = 'admin', saved, onClose }) {
  const { t, lang } = useLang()
  const { profile } = useAuth()
  const isAdmin = mode === 'admin'

  const activity = act || insc || {}
  const titulo = localize(activity?.titulo, lang) || 'Curso / Taller / Evento'
  const nombreAct = `${user?.nombres || ''} ${user?.apellidos || ''}`.trim()
  const nombreCompleto = user?.tipoPersona === 'juridico' ? user?.nombreEmpresa || nombreAct : nombreAct || user?.email || ''
  const cedulaParticipante = user?.tipoPersona === 'juridico'
    ? (user?.rif || user?.cedula || user?.dni || '')
    : (user?.cedula || user?.dni || user?.rif || '')

  const fromActivity = {
    nombre: nombreCompleto,
    cedula: cedulaParticipante,
    titulo,
    contenido: typeof activity?.contenido === 'string' ? activity.contenido : String(activity?.contenido?.es || activity?.contenido?.en || ''),
    objetivo: typeof activity?.objetivoGeneral === 'object' ? (activity.objetivoGeneral?.es || activity.objetivoGeneral?.en || '') : activity?.objetivoGeneral || '',
    facilitador: activity?.facilitadores
      ? Array.isArray(activity.facilitadores)
        ? activity.facilitadores.join('\n')
        : String(activity.facilitadores)
      : activity?.instructor || '',
    fecha: activity?.fecha || '',
    duracion: activity?.duracion || '',
    modalidad:
      activity?.modalidad && typeof activity.modalidad === 'object'
        ? activity.modalidad.es || activity.modalidad.en || ''
        : activity?.modalidad || ''
  }

  const [cert, setCert] = useState(() => {
    const src = saved && Object.keys(EMPTY_CERT).some((k) => saved[k] !== undefined) ? saved : fromActivity
    const base = { ...EMPTY_CERT }
    Object.keys(EMPTY_CERT).forEach((k) => {
      base[k] = src?.[k] ?? ''
    })
    if (cedulaParticipante) base.cedula = cedulaParticipante
    if (activity?.fecha) base.fecha = activity.fecha
    if (!base.firma1Imagen) base.firma1Imagen = EMPTY_CERT.firma1Imagen
    if (!base.firma2Imagen) base.firma2Imagen = EMPTY_CERT.firma2Imagen
    if (!base.afiliadoLogo1) base.afiliadoLogo1 = EMPTY_CERT.afiliadoLogo1
    if (!base.afiliadoLogo2) base.afiliadoLogo2 = EMPTY_CERT.afiliadoLogo2
    if (!base.firma1Nombre) base.firma1Nombre = EMPTY_CERT.firma1Nombre
    if (!base.firma2Nombre) base.firma2Nombre = EMPTY_CERT.firma2Nombre
    if (!base.firma1Cargo && /Directora Ejecutiva/i.test(base.firma2Cargo || '')) {
      base.firma1Cargo = base.firma2Cargo
      base.firma2Cargo = EMPTY_CERT.firma2Cargo
    }
    if (!base.firma1Cargo) base.firma1Cargo = EMPTY_CERT.firma1Cargo
    if (!base.firma2Cargo) base.firma2Cargo = EMPTY_CERT.firma2Cargo
    return base
  })
  const [busy, setBusy] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const set = (key, value) => {
    setCert((prev) => ({ ...prev, [key]: value }))
    setSavedOk(false)
  }

  const handleFirmaImage = (file, key) => {
    if (!file) {
      set(key, '')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set(key, String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const fmtFechaCert = (v) => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return String(v)
    return `${d.getDate()} de ${MESES[d.getMonth()]} del ${d.getFullYear()}`
  }

  const emitCertificate = async () => {
    setBusy(true)
    try {
      const uidFinal = user?.uid || user?.id || insc?.uid || ''
      const actividadIdFinal = insc?.actividadId || act?.id || ''
      const payload = {
        ...cert,
        uid: uidFinal,
        actividadId: actividadIdFinal,
        estado: 'emitido',
        creadoEn: cert.creadoEn || Date.now(),
        emitidoPor: profile?.uid || ''
      }
      await saveUserCertificate({ uid: uidFinal, actividadId: actividadIdFinal, data: payload })
      setSavedOk(true)
    } catch (err) {
      console.error(err)
      window.alert('No se pudo emitir el certificado. Revisa la conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const emailHref = user?.email
    ? `mailto:${user.email}?subject=${encodeURIComponent(`Certificado AVGH - ${titulo}`)}&body=${encodeURIComponent(
        `Hola,\n\nAdjunto el certificado de participación que acredita tu asistencia al programa "${titulo}".\n\nFecha: ${cert.fecha || ''}\nDuración: ${cert.duracion || ''}\nModalidad: ${cert.modalidad || ''}\n\nSaludos,\nAVGH`
      )}`
    : '#'

  const [downloading, setDownloading] = useState(false)
  const viewportRef = useRef(null)
  const scalerRef = useRef(null)
  const [viewScale, setViewScale] = useState(1)
  const [viewWidth, setViewWidth] = useState(780)
  const [viewHeight, setViewHeight] = useState(0)

  useEffect(() => {
    const update = () => {
      const vp = viewportRef.current
      const sc = scalerRef.current
      if (!vp || !sc) return
      const naturalWidth = 780
      const available = vp.clientWidth || naturalWidth
      const next = Math.min(1, available / naturalWidth)
      setViewWidth(available)
      setViewScale(next)
      setViewHeight(sc.scrollHeight)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadCertificatePDF(scalerRef.current, `Certificado-AVGH-${(cert.nombre || 'participante').replace(/\s+/g, '-')}.pdf`)
    } catch (err) {
      console.error(err)
      window.alert('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setDownloading(false)
    }
  }

  const modules = (cert.contenido || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const objective = (cert.objetivo || '').trim()
  const facilitatorLines = (cert.facilitador || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const afiliadoLogos = [cert.afiliadoLogo1, cert.afiliadoLogo2, cert.afiliadoLogo3, cert.afiliadoLogo4].filter(Boolean)

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal certificate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-detail-head no-print">
          <h3>
            <FaAward /> {isAdmin ? 'Generar Certificado de Participación' : 'Certificado de Participación'}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <FaXmark />
          </button>
        </div>

        {isAdmin && (
          <div className="certificate-form no-print">
            <div className="field-row">
              <label className="field-label">
                <span>Nombre del participante</span>
                <input className="input" value={cert.nombre} onChange={(e) => set('nombre', e.target.value)} />
              </label>
              <label className="field-label">
                <span>Cédula</span>
                <input className="input" value={cert.cedula} onChange={(e) => set('cedula', e.target.value)} />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">
                <span>Razón / Título del certificado</span>
                <input className="input" value={cert.titulo} onChange={(e) => set('titulo', e.target.value)} />
              </label>
              <label className="field-label">
                <span>Fecha</span>
                <input className="input" type="date" value={cert.fecha} onChange={(e) => set('fecha', e.target.value)} />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">
                <span>Duración</span>
                <input className="input" value={cert.duracion} onChange={(e) => set('duracion', e.target.value)} />
              </label>
              <label className="field-label">
                <span>Modalidad</span>
                <input className="input" value={cert.modalidad} onChange={(e) => set('modalidad', e.target.value)} />
              </label>
            </div>
            <label className="field-label">
              <span>Contenido del programa (título / módulos, uno por línea)</span>
              <textarea className="input textarea" rows={5} value={cert.contenido} onChange={(e) => set('contenido', e.target.value)} />
            </label>
            <label className="field-label">
              <span>Objetivo general</span>
              <textarea className="input textarea" rows={3} value={cert.objetivo} onChange={(e) => set('objetivo', e.target.value)} />
            </label>
            <label className="field-label">
              <span>Facilitador</span>
              <textarea className="input textarea" rows={3} value={cert.facilitador} onChange={(e) => set('facilitador', e.target.value)} />
            </label>
            <SignatureUpload
              label="Firma digital del facilitador (imagen PNG/JPG)"
              value={cert.facilitadorImagen}
              onChange={(f) => handleFirmaImage(f, 'facilitadorImagen')}
            />
            <div className="field-row">
              <label className="field-label">
                <span>Firma 1 - Nombre</span>
                <input className="input" value={cert.firma1Nombre} onChange={(e) => set('firma1Nombre', e.target.value)} />
              </label>
              <label className="field-label">
                <span>Firma 1 - Cargo</span>
                <input className="input" value={cert.firma1Cargo} onChange={(e) => set('firma1Cargo', e.target.value)} />
              </label>
            </div>
            <SignatureUpload
              label="Firma digital 1 - imagen PNG/JPG (va donde el nombre)"
              value={cert.firma1Imagen}
              onChange={(f) => handleFirmaImage(f, 'firma1Imagen')}
            />
            <div className="field-row">
              <label className="field-label">
                <span>Firma 2 - Nombre</span>
                <input className="input" value={cert.firma2Nombre} onChange={(e) => set('firma2Nombre', e.target.value)} />
              </label>
              <label className="field-label">
                <span>Firma 2 - Cargo</span>
                <input className="input" value={cert.firma2Cargo} onChange={(e) => set('firma2Cargo', e.target.value)} />
              </label>
            </div>
            <SignatureUpload
              label="Firma digital 2 - imagen PNG/JPG (va donde el nombre)"
              value={cert.firma2Imagen}
              onChange={(f) => handleFirmaImage(f, 'firma2Imagen')}
            />
            <div className="field-row">
              {[1, 2, 3, 4].map((n) => (
                <SignatureUpload
                  key={n}
                  label={`Logo afiliado ${n} (PNG)`}
                  value={cert[`afiliadoLogo${n}`]}
                  onChange={(f) => handleFirmaImage(f, `afiliadoLogo${n}`)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="certificate-viewport" ref={viewportRef}>
          <div
            className="certificate-scaler"
            ref={scalerRef}
            style={{
              transform: `scale(${viewScale})`,
              transformOrigin: 'top left',
              position: 'relative',
              left: `${Math.max(0, (viewWidth - 780 * viewScale) / 2)}px`,
              height: viewHeight ? `${viewHeight * viewScale}px` : undefined
            }}
          >
            <div className="certificate-body" id="printable-certificate">
              <div className="certificate-page">
            <div className="certificate-org-strong">La Asociación Venezolana de Gestión Humana (AVGH)</div>
            <div className="certificate-otorga">Otorga el presente certificado a:</div>
            <div className="certificate-recipient">{cert.nombre}</div>
            {cert.cedula && <div className="certificate-meta">Cédula: {cert.cedula}</div>}
            <div className="certificate-program">Por haber participado en el programa de:</div>
            <div className="certificate-program-title">{cert.titulo}</div>
            <div className="certificate-stack">
              <div>{cert.fecha ? `Caracas, ${fmtFechaCert(cert.fecha)}` : '____'}</div>
              <div><strong>Duración:</strong> {cert.duracion || '____'}</div>
              <div><strong>Modalidad:</strong> {cert.modalidad || '____'}</div>
            </div>

            <div className="certificate-signatures">
              <SignatureBlock name={cert.firma1Nombre} role={cert.firma1Cargo} image={cert.firma1Imagen} />
              <SignatureBlock name={cert.firma2Nombre} role={cert.firma2Cargo} image={cert.firma2Imagen} />
              <SignatureBlock name={facilitatorLines[0] || ''} role="Facilitador" image={cert.facilitadorImagen} />
              <div className="certificate-affiliado">
                <div className="certificate-affiliado-label">Afiliado a:</div>
                <div className="certificate-affiliado-logos">
                  {afiliadoLogos.map((src, i) => (
                    <img key={i} src={src} alt="Logo afiliado" className="certificate-affiliado-logo" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="certificate-page certificate-page-alt">
            <div className="certificate-kicker">Contenido</div>
            <div className="certificate-program-title">{cert.titulo}</div>
            {objective && (
              <>
                <div className="certificate-program">Objetivo general:</div>
                <div className="certificate-objective">{objective}</div>
              </>
            )}
            <div className="certificate-program">Lo realizado durante el programa:</div>
            <ol className="certificate-modules">
              {modules.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ol>
            <div className="certificate-program">Facilitador:</div>
            <div className="certificate-facilitator">{cert.facilitador}</div>
          </div>
            </div>
          </div>
        </div>

        <div className="ticket-actions no-print">
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-block" onClick={emitCertificate} disabled={busy}>
              <FaCircleCheck /> {busy ? 'Guardando...' : savedOk ? 'Certificado guardado ✅' : 'Emitir certificado'}
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={handleDownload} disabled={downloading}>
            <FaPrint /> {downloading ? 'Generando PDF...' : 'Descargar PDF (2 páginas)'}
          </button>
          {isAdmin && user?.email && (
            <a className="btn btn-outline btn-block" href={emailHref}>
              <FaEnvelope /> Enviar certificado por correo
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
