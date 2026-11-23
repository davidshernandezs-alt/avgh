import { useEffect, useMemo, useState } from 'react'
import {
  ref,
  set,
  onValue,
  off,
  push,
  get,
  remove,
  update,
  runTransaction
} from 'firebase/database'
import { db, DB_ROOT } from '../firebase'

export function useActivities(tipo) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const r = ref(db, `${DB_ROOT}/actividades`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        let list = Object.entries(val).map(([id, data]) => ({ id, ...data }))
        if (tipo) list = list.filter((a) => a.tipo === tipo)
        list.sort((a, b) => (a.fechaInicio || 0) - (b.fechaInicio || 0))
        setItems(list)
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [tipo])

  return { items, loading, error }
}

export function useActivity(id) {
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return undefined
    }
    let active = true
    const r = ref(db, `${DB_ROOT}/actividades/${id}`)
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val()
        setItem(val ? { id, ...val } : null)
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [id])

  return { item, loading, error }
}

export function useMyInscriptions(uid) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!uid) {
      setItems([])
      setLoading(false)
      return undefined
    }
    const r = ref(db, `${DB_ROOT}/inscripciones/${uid}`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        setItems(Object.entries(val).map(([actividadId, data]) => ({ actividadId, ...data })))
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [uid])

  return { items, loading, error }
}

export function useMyFacturas(uid) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!uid) {
      setItems([])
      setLoading(false)
      return undefined
    }
    const r = ref(db, `${DB_ROOT}/facturas/${uid}`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        setItems(Object.entries(val).map(([id, data]) => ({ id, ...data })))
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [uid])

  return { items, loading, error }
}

export async function createInscription({
  uid,
  actividad,
  user,
  metodoPago,
  estado = 'pendiente',
  tipoAsistente = 'regular',
  monto,
  desglose = null,
  afiliado = null,
  planAfiliacion = '',
  facturacion = null
}) {
  if (!uid) throw new Error('UID de usuario ausente')
  if (!actividad?.id) throw new Error('ID de actividad ausente')

  const facturaId = 'FAC_' + Math.random().toString(36).substring(2, 9)
  const numeroFactura = `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  const fecha = Date.now()
  const montoFinal = monto !== undefined && monto !== null ? Number(monto) || 0 : Number(actividad.precio) || 0

  const inscripcion = {
    fecha,
    estado,
    tipoAsistente,
    metodoPago,
    monto: montoFinal,
    facturaId,
    presente: false,
    user: user && typeof user === 'object' ? user : {},
    ...(afiliado !== null ? { afiliado } : {}),
    ...(planAfiliacion ? { planAfiliacion } : {}),
    ...(desglose ? { desglose } : {})
  }

  const tituloAct = actividad.titulo
  const concepto = typeof tituloAct === 'object' && tituloAct !== null 
    ? (tituloAct.es || tituloAct.en || 'Curso / Evento') 
    : (tituloAct || 'Curso / Evento')

  const factura = {
    numero: numeroFactura,
    actividadId: actividad.id,
    concepto,
    monto: montoFinal,
    fecha,
    metodo: metodoPago,
    estado: estado === 'confirmada' ? 'completada' : 'pendiente',
    validadaFecha: estado === 'confirmada' ? fecha : null,
    ...(desglose
      ? {
          precioBase: desglose.precioBase,
          descuentoPorcentaje: desglose.descuentoPorcentaje,
          descuentoMonto: desglose.descuentoMonto
        }
      : {}),
    ...(afiliado !== null ? { afiliado } : {}),
    ...(planAfiliacion ? { planAfiliacion } : {}),
    ...(facturacion ? { facturacion } : {})
  }

  const updates = {}
  updates[`${DB_ROOT}/inscripciones/${uid}/${actividad.id}`] = inscripcion
  updates[`${DB_ROOT}/facturas/${uid}/${facturaId}`] = factura

  await update(ref(db), updates)

  return { facturaId, numeroFactura, monto: montoFinal, desglose }
}

export async function fetchActividad(id) {
  const snap = await get(ref(db, `${DB_ROOT}/actividades/${id}`))
  const val = snap.val()
  return val ? { id, ...val } : null
}

// Todas las inscripciones con la información del usuario, la actividad y la
// factura fusionadas, para el panel del administrador.
export function useAllInscripciones() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const inscRef = ref(db, `${DB_ROOT}/inscripciones`)
    const usersRef = ref(db, `${DB_ROOT}/users`)
    const factRef = ref(db, `${DB_ROOT}/facturas`)
    let active = true

    const sync = () => {
      if (!active) return
      Promise.all([
        get(inscRef),
        get(usersRef),
        get(factRef)
      ])
        .then(([i, u, f]) => {
          if (!active) return
          const ins = i.val() || {}
          const users = u.val() || {}
          const facturas = f.val() || {}
          const list = []
          Object.entries(ins).forEach(([uid, porActividad]) => {
            const perfil = users[uid] || {}
            Object.entries(porActividad || {}).forEach(([actividadId, data]) => {
              list.push({
                uid,
                actividadId,
                fecha: data?.fecha || 0,
                estado: data?.estado || 'pendiente',
                metodoPago: data?.metodoPago || '',
                monto: data?.monto || 0,
                nota: data?.nota || '',
                facturaId: data?.facturaId || null,
                factura: data?.facturaId ? facturas[uid]?.[data.facturaId] || null : null,
                user: { ...(data?.user || {}), ...(perfil || {}) },
                presente: data?.presente === true,
                tipoAsistente: data?.tipoAsistente || 'regular'
              })
            })
          })
          list.sort((a, b) => (b.fecha || 0) - (a.fecha || 0))
          setRows(list)
          setLoading(false)
          setError(false)
        })
        .catch(() => {
          if (active) {
            setLoading(false)
            setError(true)
          }
        })
    }

    sync()
    const h1 = onValue(inscRef, sync, () => {})
    const h2 = onValue(usersRef, sync, () => {})
    const h3 = onValue(factRef, sync, () => {})

    return () => {
      active = false
      off(inscRef, 'value', h1)
      off(usersRef, 'value', h2)
      off(factRef, 'value', h3)
    }
  }, [])

  return { rows, loading, error }
}

export async function setInscripcionTipoAsistente({ uid, actividadId, tipoAsistente }) {
  await update(ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividadId}`), {
    tipoAsistente
  })
}

export async function setInscripcionEstado({ uid, actividadId, estado, nota }) {
  const updates = {}
  updates[`${DB_ROOT}/inscripciones/${uid}/${actividadId}/estado`] = estado
  updates[`${DB_ROOT}/inscripciones/${uid}/${actividadId}/validadaFecha`] = Date.now()
  if (nota !== undefined) {
    updates[`${DB_ROOT}/inscripciones/${uid}/${actividadId}/nota`] = nota || ''
  }
  const snap = await get(ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividadId}`))
  const facturaId = snap.val()?.facturaId
  if (facturaId) {
    const facturaEstado =
      estado === 'confirmada' ? 'completada' : estado === 'rechazada' ? 'rechazada' : 'pendiente'
    updates[`${DB_ROOT}/facturas/${uid}/${facturaId}/estado`] = facturaEstado
    updates[`${DB_ROOT}/facturas/${uid}/${facturaId}/validadaFecha`] = Date.now()
  }
  await update(ref(db, '/'), updates)
}

// Cambia el estado de un afiliado: bloqueo/desbloqueo o afiliado/desafiliado.
export async function setUserEstado(uid, fields) {
  await update(ref(db, `${DB_ROOT}/users/${uid}`), fields)
}

// Todas las facturas de todos los usuarios, fusionadas con el perfil de cada uno.
export function useAllFacturas() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const factRef = ref(db, `${DB_ROOT}/facturas`)
    const usersRef = ref(db, `${DB_ROOT}/users`)
    const inscRef = ref(db, `${DB_ROOT}/inscripciones`)
    let active = true

    const sync = () => {
      if (!active) return
      Promise.all([get(factRef), get(usersRef), get(inscRef)])
        .then(([f, u, i]) => {
          if (!active) return
          const facturas = f.val() || {}
          const users = u.val() || {}
          const insc = i.val() || {}
          const list = []
          Object.entries(facturas).forEach(([uid, byId]) => {
            Object.entries(byId || {}).forEach(([facturaId, data]) => {
              // Buscar usuario registrado o datos guardados en inscripciones
              let uData = users[uid] || {}
              if (!uData.nombres && insc[uid]) {
                const firstAct = Object.values(insc[uid])[0]
                if (firstAct && firstAct.user) {
                  uData = firstAct.user
                }
              }
              let actividadId = data?.actividadId || ''
              if (!actividadId && insc[uid]) {
                const match = Object.entries(insc[uid]).find(([, act]) => act?.facturaId === facturaId)
                if (match) actividadId = match[0]
              }
              list.push({
                uid,
                facturaId,
                actividadId,
                factura: data,
                user: uData
              })
            })
          })
          list.sort((a, b) => (b.factura?.fecha || 0) - (a.factura?.fecha || 0))
          setRows(list)
          setLoading(false)
          setError(false)
        })
        .catch(() => {
          if (active) {
            setLoading(false)
            setError(true)
          }
        })
    }

    sync()
    const h1 = onValue(factRef, sync, () => {})
    const h2 = onValue(usersRef, sync, () => {})
    const h3 = onValue(inscRef, sync, () => {})
    return () => {
      active = false
      off(factRef, 'value', h1)
      off(usersRef, 'value', h2)
      off(inscRef, 'value', h3)
    }
  }, [])

  return { rows, loading, error }
}

// Todos los perfiles de usuarios afiliados.
export function useAllUsers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const r = ref(db, `${DB_ROOT}/users`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        const list = Object.entries(val).map(([uid, data]) => ({ uid, ...data }))
        list.sort((a, b) => (b.fechaRegistro || 0) - (a.fechaRegistro || 0))
        setItems(list)
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [])

  return { items, loading, error }
}

export async function uploadComprobante({ uid, facturaId, dataUrl, nombre, tipo }) {
  await update(ref(db, `${DB_ROOT}/facturas/${uid}/${facturaId}`), {
    comprobante: dataUrl,
    comprobanteNombre: nombre,
    comprobanteTipo: tipo,
    comprobanteFecha: Date.now()
  })
}

export function useBankConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const r = ref(db, `${DB_ROOT}/config/bancos`)
    let active = true
    const h = onValue(r, (snap) => {
      if (!active) return
      setConfig(snap.val() || {})
      setLoading(false)
    }, () => { if (active) setLoading(false) })
    return () => { active = false; off(r, 'value', h) }
  }, [])

  return { config, loading }
}

export async function saveBankConfig(data) {
  await set(ref(db, `${DB_ROOT}/config/bancos`), data)
}

export function useAffiliationConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const r = ref(db, `${DB_ROOT}/config/afiliaciones`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        setConfig(snap.val() || {})
        setLoading(false)
      },
      () => {
        if (active) setLoading(false)
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [])

  return { config, loading }
}

export async function saveAffiliationConfig(data) {
  await set(ref(db, `${DB_ROOT}/config/afiliaciones`), data)
}

// Solicitudes de afiliación enviadas desde la página pública, fusionadas con
// el perfil del usuario y la factura generada para que el admin pueda revisar
// los recaudos y aprobar o rechazar en un solo lugar.
export function useAffiliationRequests() {
  const [requests, setRequests] = useState({})
  const [users, setUsers] = useState({})
  const [facturas, setFacturas] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const reqRef = ref(db, `${DB_ROOT}/afiliaciones_solicitudes`)
    const usersRef = ref(db, `${DB_ROOT}/users`)
    const factRef = ref(db, `${DB_ROOT}/facturas`)
    let active = true

    const onError = () => {
      if (active) {
        setLoading(false)
        setError(true)
      }
    }

    const h1 = onValue(
      reqRef,
      (snap) => {
        if (!active) return
        setRequests(snap.val() || {})
        setLoading(false)
        setError(false)
      },
      onError
    )
    const h2 = onValue(usersRef, (snap) => {
      if (active) setUsers(snap.val() || {})
    }, onError)
    const h3 = onValue(factRef, (snap) => {
      if (active) setFacturas(snap.val() || {})
    }, onError)

    return () => {
      active = false
      off(reqRef, 'value', h1)
      off(usersRef, 'value', h2)
      off(factRef, 'value', h3)
    }
  }, [])

  const items = useMemo(
    () =>
      Object.entries(requests)
        .map(([uid, data]) => ({
          uid,
          ...(data || {}),
          user: users[uid] || {},
          factura: data?.facturaId ? facturas[uid]?.[data.facturaId] || null : null
        }))
        .sort((a, b) => (b.fecha || 0) - (a.fecha || 0)),
    [requests, users, facturas]
  )

  return { items, loading, error }
}

function withoutEmpty(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  )
}

function approvedProfileFields(request, now, adminUid, nota = '') {
  const tipo = request.tipo === 'corporativo' ? 'corporativo' : 'individual'
  const base = {
    afiliado: true,
    tipoAfiliacion: tipo,
    planAfiliacion: tipo,
    afiliadoDesde: now,
    onboardingCompleted: true,
    solicitudAfiliacion: {
      tipo,
      estado: 'aprobada',
      fecha: request.fecha || now,
      revisadaFecha: now,
      revisadaPor: adminUid || '',
      facturaId: request.facturaId || null,
      nota: nota || ''
    }
  }

  if (tipo === 'corporativo') {
    return {
      ...base,
      ...withoutEmpty({
        tipoPersona: 'juridico',
        nombreEmpresa: request.razonSocial || request.nombreEmpresa,
        rif: request.rif,
        email: request.emailCorp || request.email,
        telefono: request.telefonos || request.telefono,
        telefonoEmpresa: request.telefonos,
        direccionFiscal: request.direccion,
        cargo: request.contactoCargo,
        nombres: request.contactoNombres || request.gerenteNombres,
        apellidos: request.contactoApellidos || request.gerenteApellidos,
        dni: request.contactoDni || request.gerenteDni
      })
    }
  }

  return {
    ...base,
    ...withoutEmpty({
      tipoPersona: 'natural',
      nombres: request.nombres,
      apellidos: request.apellidos,
      dni: request.dni,
      email: request.email,
      telefono: request.telefonos || request.movil,
      cargo: request.cargo,
      empresa: request.empresa,
      direccionHabitacion: request.direccionHabitacion,
      ciudad: request.ciudad,
      estado: request.estado
    })
  }
}

export async function approveAffiliationRequest({ uid, request, adminUid, nota = '' }) {
  const now = Date.now()
  const updates = {
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/estado`]: 'aprobada',
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/revisadaFecha`]: now,
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/revisadaPor`]: adminUid || '',
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/notaAdmin`]: nota || ''
  }

  const profile = approvedProfileFields(request, now, adminUid, nota)
  Object.entries(profile).forEach(([key, value]) => {
    updates[`${DB_ROOT}/users/${uid}/${key}`] = value
  })

  if (request.facturaId) {
    updates[`${DB_ROOT}/facturas/${uid}/${request.facturaId}/estado`] = 'completada'
    updates[`${DB_ROOT}/facturas/${uid}/${request.facturaId}/validadaFecha`] = now
  }

  await update(ref(db, '/'), updates)
}

export async function rejectAffiliationRequest({ uid, request, adminUid, nota = '' }) {
  const now = Date.now()
  const updates = {
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/estado`]: 'rechazada',
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/revisadaFecha`]: now,
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/revisadaPor`]: adminUid || '',
    [`${DB_ROOT}/afiliaciones_solicitudes/${uid}/notaAdmin`]: nota || '',
    [`${DB_ROOT}/users/${uid}/solicitudAfiliacion`]: {
      tipo: request.tipo,
      estado: 'rechazada',
      fecha: request.fecha || now,
      revisadaFecha: now,
      revisadaPor: adminUid || '',
      nota: nota || '',
      facturaId: request.facturaId || null
    }
  }

  if (request.facturaId) {
    updates[`${DB_ROOT}/facturas/${uid}/${request.facturaId}/estado`] = 'rechazada'
    updates[`${DB_ROOT}/facturas/${uid}/${request.facturaId}/validadaFecha`] = now
  }

  await update(ref(db, '/'), updates)
}

const PROTECTED_USER_FIELDS = new Set([
  'afiliado',
  'tipoAfiliacion',
  'planAfiliacion',
  'afiliadoDesde',
  'onboardingCompleted',
  'solicitudAfiliacion',
  'bloqueado',
  'bloqueadoFecha',
  'rol',
  'foto'
])

// Afiliación manual desde Inscritos o Afiliados. No crea factura: solo
// sincroniza el estatus del usuario y el plan elegido por el administrador.
export async function setUserAffiliation({
  uid,
  tipoAfiliacion = 'individual',
  afiliado = true,
  userData = {}
}) {
  const now = Date.now()
  const plan = tipoAfiliacion === 'corporativo' ? 'corporativo' : 'individual'
  const updates = {
    [`${DB_ROOT}/users/${uid}/afiliado`]: afiliado,
    [`${DB_ROOT}/users/${uid}/tipoAfiliacion`]: afiliado ? plan : null,
    [`${DB_ROOT}/users/${uid}/planAfiliacion`]: afiliado ? plan : null,
    [`${DB_ROOT}/users/${uid}/afiliadoDesde`]: afiliado ? now : null,
    [`${DB_ROOT}/users/${uid}/onboardingCompleted`]: true
  }

  if (afiliado && userData) {
    Object.entries(userData).forEach(([key, value]) => {
      if (PROTECTED_USER_FIELDS.has(key)) return
      if (value === undefined || value === null || value === '') return
      if (typeof value === 'object') return
      updates[`${DB_ROOT}/users/${uid}/${key}`] = value
    })
  }

  await update(ref(db, '/'), updates)
}

// Certificados emitidos para asistentes que confirmaron su asistencia. Se
// guardan por usuario y actividad: certificados/{uid}/{actividadId}
export function useUserCertificates(uid) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!uid) {
      setItems([])
      setLoading(false)
      return undefined
    }
    const r = ref(db, `${DB_ROOT}/certificados/${uid}`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        const list = Object.entries(val).map(([actividadId, data]) => ({ actividadId, ...data }))
        list.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0))
        setItems(list)
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [uid])

  return { items, loading, error }
}

export async function saveUserCertificate({ uid, actividadId, data }) {
  const cleanUid = uid || ''
  const cleanActividadId = actividadId || ''
  const payload = {
    uid: cleanUid,
    actividadId: cleanActividadId,
    ...(data || {}),
    estado: 'emitido',
    creadoEn: data?.creadoEn || Date.now()
  }
  if (!cleanUid || !cleanActividadId) {
    throw new Error('Faltan uid o actividadId para emitir el certificado')
  }
  // Si el admin emite desde una fila con uid sintético (emp_...), guardamos
  // también una copia bajo el uid real de Auth para que el usuario lo vea.
  let canonicalUid = cleanUid
  try {
    const dniDigits = String(data?.dni || '').replace(/\D/g, '')
    const snap = await get(ref(db, `${DB_ROOT}/users`))
    const users = snap.val() || {}
    for (const [uId, u] of Object.entries(users)) {
      if (u?.uidOrigen === cleanUid || (dniDigits && String(u?.dni || '').replace(/\D/g, '') === dniDigits)) {
        canonicalUid = uId
        break
      }
    }
  } catch {
    /* ignore */
  }
  const updates = {
    [`${DB_ROOT}/certificados/${cleanUid}/${cleanActividadId}`]: payload
  }
  if (canonicalUid && canonicalUid !== cleanUid) {
    updates[`${DB_ROOT}/certificados/${canonicalUid}/${cleanActividadId}`] = payload
  }
  await update(ref(db, '/'), updates)
  return payload
}

// Preguntas en vivo del Q&A por actividad.
export function usePreguntas(actividadId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!actividadId) {
      setRows([])
      setLoading(false)
      return undefined
    }
    const r = ref(db, `${DB_ROOT}/preguntas/${actividadId}`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        const list = Object.entries(val).map(([id, data]) => ({ id, ...data }))
        list.sort((a, b) => (a.fecha || 0) - (b.fecha || 0))
        setRows(list)
        setLoading(false)
      },
      () => { if (active) setLoading(false) }
    )
    return () => { active = false; off(r, 'value', h) }
  }, [actividadId])

  return { rows, loading }
}

export async function addPregunta({ actividadId, texto, uid, user }) {
  if (!actividadId || !texto?.trim()) throw new Error('Faltan datos de la pregunta')
  const r = push(ref(db, `${DB_ROOT}/preguntas/${actividadId}`))
  await set(r, {
    uid: uid || '',
    user: {
      nombres: user?.nombres || '',
      apellidos: user?.apellidos || '',
      email: user?.email || '',
      dni: user?.dni || ''
    },
    texto: texto.trim(),
    fecha: Date.now(),
    respondida: false
  })
  return r.key
}

export async function setPreguntaRespondida(actividadId, preguntaId, respondida) {
  if (!actividadId || !preguntaId) return
  await update(ref(db, `${DB_ROOT}/preguntas/${actividadId}/${preguntaId}`), {
    respondida: !!respondida,
    respondidaFecha: respondida ? Date.now() : null
  })
}

export async function deletePregunta(actividadId, preguntaId) {
  if (!actividadId || !preguntaId) return
  await remove(ref(db, `${DB_ROOT}/preguntas/${actividadId}/${preguntaId}`))
}

export async function submitSurvey({ uid, actividadId, actividadTitulo, respuestas, comentarios, user }) {
  if (!uid || !actividadId) throw new Error('Faltan datos de la encuesta')
  const fecha = Date.now()
  const updates = {
    [`${DB_ROOT}/encuestas/${actividadId}/${uid}`]: {
      uid,
      actividadId,
      actividadTitulo: actividadTitulo || '',
      user: {
        nombres: user?.nombres || '',
        apellidos: user?.apellidos || '',
        email: user?.email || '',
        dni: user?.dni || ''
      },
      respuestas,
      comentarios,
      fecha
    },
    [`${DB_ROOT}/inscripciones/${uid}/${actividadId}/encuestaCompletada`]: true,
    [`${DB_ROOT}/inscripciones/${uid}/${actividadId}/encuestaFecha`]: fecha
  }
  await update(ref(db, '/'), updates)
}

// Todas las respuestas de encuestas (para métricas del admin).
export function useSurveyResponses() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const r = ref(db, `${DB_ROOT}/encuestas`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        const list = []
        Object.entries(val).forEach(([actividadId, byUid]) => {
          Object.entries(byUid || {}).forEach(([uid, data]) => {
            list.push({ actividadId, uid, ...data })
          })
        })
        list.sort((a, b) => (b.fecha || 0) - (a.fecha || 0))
        setRows(list)
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [])

  return { rows, loading, error }
}

export async function markSurveyCompleted(uid, actividadId) {
  if (!uid || !actividadId) throw new Error('Faltan datos de la encuesta')
  await update(ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividadId}`), {
    encuestaCompletada: true,
    encuestaFecha: Date.now()
  })
}

export async function deleteUserCertificate(uid, actividadId) {
  const updates = {
    [`${DB_ROOT}/certificados/${uid}/${actividadId}`]: null
  }
  // Si el certificado se guardó también bajo el uid real de Auth, borramos esa copia.
  try {
    const snap = await get(ref(db, `${DB_ROOT}/users`))
    const users = snap.val() || {}
    for (const [uId, u] of Object.entries(users)) {
      if (u?.uidOrigen === uid || (uId !== uid && `${u?.dni || ''}`.replace(/\D/g, '') && `${u?.dni || ''}`.replace(/\D/g, '') === `${(uid.match(/\d+/) || [''])[0]}`)) {
        updates[`${DB_ROOT}/certificados/${uId}/${actividadId}`] = null
      }
    }
  } catch {
    /* ignore */
  }
  await update(ref(db, '/'), updates)
}

export async function saveActividad(id, data) {
  const target = id ? ref(db, `${DB_ROOT}/actividades/${id}`) : push(ref(db, `${DB_ROOT}/actividades`))
  await set(target, data)
  return target.key
}

export async function deleteActividad(id) {
  await remove(ref(db, `${DB_ROOT}/actividades/${id}`))
}

export async function deleteInscription(uid, actividadId) {
  await remove(ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividadId}`))
}

export async function deleteInvoice(uid, facturaId) {
  await remove(ref(db, `${DB_ROOT}/facturas/${uid}/${facturaId}`))
}

export async function deleteUserAccount(uid) {
  const updates = {}
  updates[`${DB_ROOT}/users/${uid}`] = null
  updates[`${DB_ROOT}/inscripciones/${uid}`] = null
  updates[`${DB_ROOT}/facturas/${uid}`] = null
  await update(ref(db, '/'), updates)
}

// ============ NOTICIAS / POSTS ============

// Publicaciones de noticias (feed estilo Instagram). Uso público.
export function usePosts() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const r = ref(db, `${DB_ROOT}/posts`)
    let active = true
    const h = onValue(
      r,
      (snap) => {
        if (!active) return
        const val = snap.val() || {}
        const list = Object.entries(val).map(([id, data]) => ({
          id,
          likes: data.likes || {},
          comentarios: data.comentarios || {},
          ...data
        }))
        list.sort((a, b) => (b.fecha || 0) - (a.fecha || 0))
        setItems(list)
        setLoading(false)
        setError(false)
      },
      () => {
        if (active) {
          setLoading(false)
          setError(true)
        }
      }
    )
    return () => {
      active = false
      off(r, 'value', h)
    }
  }, [])

  return { items, loading, error }
}

export async function savePost(id, data) {
  const target = id ? ref(db, `${DB_ROOT}/posts/${id}`) : push(ref(db, `${DB_ROOT}/posts`))
  await set(target, data)
  return target.key
}

export async function deletePost(id) {
  await remove(ref(db, `${DB_ROOT}/posts/${id}`))
}

// Marca o quita el "me gusta" del usuario sobre una publicación.
export async function togglePostLike(postId, uid) {
  const likeRef = ref(db, `${DB_ROOT}/posts/${postId}/likes/${uid}`)
  await runTransaction(likeRef, (cur) => (cur ? null : true))
}

export async function addPostComment(postId, { uid, nombre, texto }) {
  const refs = push(ref(db, `${DB_ROOT}/posts/${postId}/comentarios`))
  await set(refs, { uid, nombre, texto, fecha: Date.now() })
  return refs.key
}

export function useAllCompaniesEmployees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const compRef = ref(db, `${DB_ROOT}/companies`)
    let active = true
    const h = onValue(compRef, (snap) => {
      if (!active) return
      const val = snap.val() || {}
      const list = []
      Object.entries(val).forEach(([companyUid, compData]) => {
        const companyName = compData.nombreEmpresa || compData.nombres || 'Empresa'
        const emps = compData.employees || {}
        Object.entries(emps).forEach(([empId, empData]) => {
          list.push({
            id: empId,
            companyUid,
            companyName,
            ...empData
          })
        })
      })
      list.sort((a, b) => (b.fechaRegistro || 0) - (a.fechaRegistro || 0))
      setEmployees(list)
      setLoading(false)
    }, () => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      off(compRef, 'value', h)
    }
  }, [])

  return { employees, loading }
}