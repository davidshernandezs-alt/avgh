import { useState, useRef, useEffect } from 'react'
import { FaQrcode, FaCircleCheck, FaUser, FaBuilding, FaBook, FaMoneyBillWave, FaCamera, FaStop, FaUpload, FaPen, FaCheck } from 'react-icons/fa6'
import { ref, get, update, set } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'
import { useLang } from '../i18n'
import { localize } from '../utils/localized'
import { formatDate } from '../components/ActivityCard'
import { useBankConfig } from '../data/useData'
import { cameraSupport } from '../utils/permissions'
import { notifyScan } from '../components/ScanToast'

export default function AdminQRValidation() {
  const { t, lang } = useLang()
  const { config: bankConfig } = useBankConfig()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [shareMode, setShareMode] = useState('attendance') // 'attendance' o 'share'
  const [customUrl, setCustomUrl] = useState('')
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [urlMsg, setUrlMsg] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastScannedTimeRef = useRef(0)
  const lastScannedCodeRef = useRef(null)
  const validatingRef = useRef(false)
  const scanPausedUntilRef = useRef(0)
  const audioCtxRef = useRef(null)

  const playSuccessBeep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.18)
    } catch {
      /* el sonido es opcional */
    }
  }

  useEffect(() => {
    if (bankConfig?.appUrl) {
      setCustomUrl(bankConfig.appUrl)
    } else if (window.location.protocol === 'file:') {
      setCustomUrl('https://avgh-app.vercel.app')
    } else {
      setCustomUrl(window.location.origin)
    }
  }, [bankConfig])

  // URL activa para compartir (la personalizada guardada o Vercel por defecto si se abre local)
  const rawAppUrl = (customUrl && customUrl.trim()) || (window.location.protocol === 'file:' ? 'https://avgh-app.vercel.app' : window.location.origin)
  const appUrl = rawAppUrl.startsWith('file:') ? 'https://avgh-app.vercel.app' : rawAppUrl
  // Generar URL para la API de QR
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`

  const handleSaveUrl = async (e) => {
    e.preventDefault()
    setBusy(true)
    setUrlMsg(false)
    try {
      const currentBank = bankConfig || {}
      await set(ref(db, `${DB_ROOT}/config/bancos`), {
        ...currentBank,
        appUrl: customUrl.trim()
      })
      setIsEditingUrl(false)
      setUrlMsg(true)
      setTimeout(() => setUrlMsg(false), 3000)
    } catch {
      alert('Error al guardar la URL')
    } finally {
      setBusy(false)
    }
  }

  const handleValidate = async (rawCode) => {
    const clean = (rawCode || code).trim()
    if (!clean) return

    // Evitar lecturas duplicadas: usamos refs porque el intervalo de escaneo
    // captura el estado inicial y no ve los cambios de useState.
    const now = Date.now()
    if (validatingRef.current) return
    if (lastScannedCodeRef.current === clean && now - lastScannedTimeRef.current < 4000) {
      return
    }
    validatingRef.current = true
    lastScannedCodeRef.current = clean
    lastScannedTimeRef.current = now
    setLastScannedCode(clean)

    setError('')
    setBusy(true)

    try {
      // Decodificar por si el QR viene URL-encoded (AVGH%7Cuid%7Cact) o dentro de una URL (?data=...)
      let decoded = clean
      try { decoded = decodeURIComponent(clean) } catch { /* ya venía decodificado */ }
      const urlData = decoded.match(/[?&]data=([^&]+)/)
      if (urlData) {
        try { decoded = decodeURIComponent(urlData[1]) } catch { decoded = urlData[1] }
      }

      let parts = decoded.split('|')
      const idx = decoded.indexOf('AVGH|')
      if (idx >= 0) parts = decoded.slice(idx).split('|')

      if (parts.length < 2 || parts[0] !== 'AVGH') {
        setError(t('qr.invalidCode') || 'Código QR no válido')
        setBusy(false)
        return
      }

      let uid = (parts[1] || '').trim()
      let actividadId = (parts[2] || '').trim()
      let foundUid = uid

      // 1) Ruta directa: inscripciones/{uid}/{actividadId}
      let inscSnap = uid && actividadId
        ? await get(ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividadId}`))
        : null

      // 2) QR con solo uid: tomar la primera actividad inscrita
      if (!inscSnap?.exists() && uid && !actividadId) {
        const byUid = await get(ref(db, `${DB_ROOT}/inscripciones/${uid}`))
        if (byUid.exists()) {
          actividadId = Object.keys(byUid.val())[0]
          inscSnap = await get(ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividadId}`))
        }
      }

      // 3) El QR puede traer la cédula en vez del uid: buscar en TODAS las inscripciones
      const candidatos = [uid, (parts[3] || '').trim()].filter(Boolean)
      if (!inscSnap?.exists() && candidatos.length) {
        const allSnap = await get(ref(db, `${DB_ROOT}/inscripciones`))
        const all = allSnap.val() || {}
        let encontrado = false
        for (const cand of candidatos) {
          const q = cand.toLowerCase()
          for (const [u, acts] of Object.entries(all)) {
            for (const [aId, data] of Object.entries(acts || {})) {
              const pu = data?.user || {}
              const ids = [pu.dni, pu.cedula, u].map((x) => String(x || '').toLowerCase())
              if (ids.some((x) => x === q || (q.length >= 6 && x.includes(q)))) {
                foundUid = u
                actividadId = aId
                inscSnap = await get(ref(db, `${DB_ROOT}/inscripciones/${u}/${aId}`))
                encontrado = true
                break
              }
            }
            if (encontrado) break
          }
          if (encontrado) break
        }
      }

      const insc = inscSnap?.val()
      if (!insc) {
        setError(t('qr.notFound') || 'No se encontró la inscripción o el participante')
        setBusy(false)
        return
      }
      foundUid = foundUid || uid

      // Los inscritos manualmente/importados pueden no tener nodo en /users.
      // En ese caso usamos los datos guardados dentro de la inscripción.
      const [userSnap, actSnap] = await Promise.all([
        get(ref(db, `${DB_ROOT}/users/${foundUid}`)),
        get(ref(db, `${DB_ROOT}/actividades/${actividadId}`))
      ])
      const user = userSnap.val() || insc.user || null
      const act = actSnap.val()

      let factura = null
      if (insc.facturaId) {
        const facSnap = await get(ref(db, `${DB_ROOT}/facturas/${foundUid}/${insc.facturaId}`))
        factura = facSnap.val()
      }

      // Marcar asistencia presencial (presente: true) en la base de datos
      window.__avghAttendanceUpdateUntil = Date.now() + 2500
      await update(ref(db, `${DB_ROOT}/inscripciones/${foundUid}/${actividadId}`), {
        presente: true,
        fechaAsistencia: Date.now()
      })
      const updatedInsc = { ...insc, presente: true }
      playSuccessBeep()

      // NO detenemos la cámara, el escaneo sigue activo de forma continua y fluida.
      setResult({
        user,
        insc: updatedInsc,
        act: act || { titulo: { es: 'Curso/Taller', en: 'Course' } },
        factura
      })
      notifyScan({
        nombre: `${user?.nombres || ''} ${user?.apellidos || ''}`.trim() || 'Participante',
        cedula: user?.dni || user?.cedula || '',
        empresa: user?.nombreEmpresa || user?.empresa || '',
        actividad: act?.titulo
          ? (typeof act.titulo === 'object' ? (act.titulo.es || act.titulo.en) : act.titulo)
          : ''
      })
      setShowSuccessModal(true)
      // Pausar el escaneo mientras se muestra el resultado para no repetir sonido/lectura
      scanPausedUntilRef.current = Date.now() + 2500

      // Auto cerrar el modal de éxito flotante / limpiar código tras 2.5 segundos para seguir escaneando sin pausa
      setTimeout(() => {
        setShowSuccessModal(false)
        setCode('')
      }, 2500)

    } catch {
      setError(t('qr.errorRead') || 'Error al validar el código QR')
    } finally {
      validatingRef.current = false
      setBusy(false)
    }
  }

  // Iniciar flujo de video en vivo desde la cámara
  const startCamera = async () => {
    setError('')
    setResult(null)
    try {
      const support = cameraSupport()
      if (!support.ok) {
        setError(support.message)
        return
      }
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }
      streamRef.current = stream
      lastScannedCodeRef.current = null
      lastScannedTimeRef.current = 0
      scanPausedUntilRef.current = 0
      setCameraActive(true)

      // Dar tiempo al DOM para renderizar el elemento video
      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
          } catch (playErr) {
            console.error('Video play error:', playErr)
          }
        }
      }, 100)

      // Iniciar escaneo continuo de frames si se soporta BarcodeDetector
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        scanIntervalRef.current = setInterval(async () => {
          if (validatingRef.current || Date.now() < scanPausedUntilRef.current) return
          if (videoRef.current && videoRef.current.readyState === 4) {
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const val = barcodes[0].rawValue
                setCode(val)
                handleValidate(val)
              }
            } catch {
              /* ignore frame errors */
            }
          }
        }, 500)
      }
    } catch (err) {
      console.error('Camera error:', err)
      const name = err?.name || ''
      const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
      const notFound = name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError'
      setError(
        denied
          ? 'Permiso de cámara denegado. Ve a Ajustes del navegador → Permisos → Cámara y permítelo, o reinstala la app.'
          : notFound
            ? 'No se detectó una cámara disponible en este dispositivo.'
            : 'No se pudo acceder a la cámara. Asegúrate de usar HTTPS y de permitir los permisos.'
      )
      setCameraActive(false)
    }
  }

  // Detener cámara
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    validatingRef.current = false
    lastScannedCodeRef.current = null
    scanPausedUntilRef.current = 0
    setCameraActive(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  // Leer QR desde archivo (fallback opcional)
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)

    try {
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const imageBitmap = await createImageBitmap(file)
        const barcodes = await detector.detect(imageBitmap)
        if (barcodes.length > 0) {
          const val = barcodes[0].rawValue
          setCode(val)
          await handleValidate(val)
          return
        }
      }
      setError('No se detectó un código QR válido en la imagen.')
    } catch {
      setError('Error al procesar el archivo.')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <section className="panel">
      <div className="panel-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaQrcode />
          <h3>{t('admin.tabQR')} - QR y Asistencia</h3>
        </div>
        <div className="btn-row btn-row-sm">
          <button
            type="button"
            className={`btn ${shareMode === 'attendance' ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setShareMode('attendance')}
          >
            📷 Escáner de Asistencia
          </button>
          <button
            type="button"
            className={`btn ${shareMode === 'share' ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setShareMode('share')}
          >
            🔗 QR para Compartir App
          </button>
        </div>
      </div>

      {shareMode === 'share' ? (
        <div className="admin-section" style={{ textAlign: 'center', padding: '20px 0' }}>
          <h3>Código QR para Compartir la Aplicación AVGH</h3>
          <p className="auth-hint" style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
            Muestra o comparte este código QR con tus usuarios, empleados o invitados para que puedan escanearlo con la cámara de sus teléfonos y acceder instantáneamente a la plataforma AVGH.
          </p>

          <div style={{ background: '#fff', padding: '20px', display: 'inline-block', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
            <img
              src={qrApiUrl}
              alt="QR Compartir Aplicación AVGH"
              style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto' }}
            />
          </div>

          <div style={{ marginBottom: '16px', maxWidth: '450px', margin: '0 auto 16px' }}>
            {!isEditingUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <a href={appUrl} target="_blank" rel="noopener noreferrer" className="link-muted" style={{ fontWeight: 'bold', fontSize: '15px' }}>
                  🌐 {appUrl}
                </a>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsEditingUrl(true)}
                  title="Editar dirección URL"
                >
                  <FaPen /> Editar URL
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveUrl} className="form" style={{ background: 'var(--bg-muted)', padding: '14px', borderRadius: '8px' }}>
                <label className="field-label" style={{ textAlign: 'left', marginBottom: '8px' }}>
                  <span>URL o Dominio Asociado al QR:</span>
                  <input
                    type="url"
                    className="input"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://tu-app.vercel.app"
                    required
                  />
                </label>
                <div className="btn-row btn-row-sm" style={{ justifyContent: 'center' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    <FaCheck /> {busy ? 'Guardando...' : 'Guardar URL'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditingUrl(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {urlMsg && <p className="form-success" style={{ marginTop: '8px' }}>✅ ¡URL actualizada con éxito!</p>}
          </div>

          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                navigator.clipboard.writeText(appUrl)
                alert('✅ ¡Enlace de la aplicación copiado al portapapeles!')
              }}
            >
              📋 Copiar Enlace de la App
            </button>
            <a
              href={qrApiUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="QR_AVGH_App.png"
              className="btn btn-outline"
            >
              📥 Descargar Imagen QR
            </a>
          </div>
        </div>
      ) : (
        <>
          <p className="auth-hint">
            Escanea el carnet/QR del participante al momento de ingresar al evento para registrar su asistencia presencial en tiempo real.
          </p>

          {/* Visor de Cámara en Vivo */}
          <div className="qr-controls" style={{ marginBottom: '16px' }}>
            {!cameraActive ? (
              <button type="button" className="btn btn-primary btn-block" onClick={startCamera}>
                <FaCamera /> Iniciar Escáner por Cámara en Vivo
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-block text-danger" onClick={stopCamera}>
                <FaStop /> Detener Cámara
              </button>
            )}
          </div>

          {cameraActive && (
            <div className="camera-preview-container" style={{ textAlign: 'center', marginBottom: '16px', width: '100%', overflow: 'hidden' }}>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                style={{
                  width: '100%',
                  maxWidth: '280px',
                  aspectRatio: '1 / 1',
                  height: 'auto',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '3px solid var(--blue)',
                  background: '#000',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
              <p className="auth-hint" style={{ marginTop: '6px' }}>Apunte la cámara al código QR del participante...</p>
            </div>
          )}

          {/* Opción secundaria: buscar archivo si se prefiere */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <button
              type="button"
              className="link-muted"
              style={{ fontSize: '12px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <FaUpload /> O subir imagen/foto desde dispositivo
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden-input"
              onChange={handleScanFile}
            />
          </div>

          {/* Ingreso Manual del código QR */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleValidate(code)
            }}
            className="form qr-form"
          >
            <div className="field-row">
              <input
                type="text"
                className="input"
                placeholder={t('qr.placeholder') || 'O pega/escribe el código QR manualmente'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="btn btn-primary" disabled={busy || !code.trim()}>
                {busy ? '...' : t('qr.verify')}
              </button>
            </div>
          </form>

          {error && <div className="form-error qr-result-box" style={{ marginTop: '14px' }}>{error}</div>}

          {result && (
            <div className={`qr-result-card is-valid ${showSuccessModal ? 'animate-fade-in' : ''}`} style={{ marginTop: '16px', border: showSuccessModal ? '2px solid var(--success)' : undefined }}>
              <div className="qr-result-header">
                <FaCircleCheck className="text-success" />
                <div>
                  <h4 style={{ color: 'var(--success)' }}>
                    ✅ ¡Asistencia Registrada con Éxito! {showSuccessModal && <span style={{fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)'}}>(Continuando escaneo...)</span>}
                  </h4>
                  <span>{formatDate(result.insc.fechaAsistencia || Date.now(), lang)}</span>
                </div>
              </div>

              <div className="admin-grid qr-grid">
                <div className="admin-section">
                  <h4>{t('qr.participant')}</h4>
                  <ul className="admin-list">
                    <li>
                      <strong>{t('profile.personType')}:</strong>{' '}
                      {result.user.tipoPersona === 'juridico' ? <FaBuilding /> : <FaUser />}{' '}
                      {result.user.tipoPersona === 'juridico' ? result.user.nombreEmpresa : 'Natural'}
                    </li>
                    <li>
                      <strong>{t('admin.table.student')}:</strong> {result.user.nombres} {result.user.apellidos}
                    </li>
                    <li>
                      <strong>Cédula:</strong> {result.user.dni || result.user.cedula || '—'}
                    </li>
                    <li>
                      <strong>{t('home.email')}:</strong> {result.user.email}
                    </li>
                  </ul>
                </div>

                <div className="admin-section">
                  <h4>{t('qr.courseInfo')}</h4>
                  <ul className="admin-list">
                    <li>
                      <strong>{t('qr.course')}:</strong> <FaBook /> {localize(result.act.titulo, lang)}
                    </li>
                    <li>
                      <strong>Estado de Pago:</strong>{' '}
                      <span className="badge badge-Confirmada">Pago Aprobado</span>
                    </li>
                    <li>
                      <strong>Asistencia Presencial:</strong>{' '}
                      <span className="badge badge-Confirmada">PRESENTE</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                className="btn btn-outline btn-block"
                style={{ marginTop: '14px' }}
                onClick={() => {
                  setResult(null)
                  setCode('')
                  setLastScannedCode(null)
                }}
              >
                {t('qr.scanAnother') || 'Escanear Otro Participante'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}