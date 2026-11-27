import * as XLSX from 'xlsx'
import { initializeApp, getApps } from 'firebase/app'
import { ref, get, update } from 'firebase/database'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { db, DB_ROOT, firebaseConfig } from '../firebase'

// App secundaria para crear cuentas sin desloguear al admin que importa.
const APP_NAME = 'avgh-affiliate-import'
const importApp = getApps().find((a) => a.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME)

const norm = (v) => String(v ?? '').trim()
const lower = (v) => norm(v).toLowerCase()
const keyOf = (v) => lower(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
const digits = (v) => String(v ?? '').replace(/\D/g, '')

function primerEmail(valor) {
  const texto = lower(valor).replace(/[,;]/g, ' ')
  const match = texto.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)
  return match ? match[0] : ''
}

const CANON = {
  nombres: ['nombres', 'nombre'],
  razon: ['razon social', 'razonsocial', 'r. social'],
  apellidos: ['apellidos', 'apellido'],
  ci: ['cedula', 'dni', 'ci', 'documento', 'identificacion'],
  rif: ['rif'],
  empresa: ['empresa', 'nombreempresa', 'compania', 'razonsocial'],
  correo: ['correo', 'email', 'mail'],
  telefono: ['telefono', 'celular', 'wts', 'whatsapp', 'telf'],
  cargo: ['cargo'],
  categoria: ['categoria', 'tipo', 'plan', 'tipoafiliacion'],
  persona: ['tipopersona', 'persona', 'naturalojuridico']
}

const findCol = (headers, terms) => {
  const keys = headers.map(keyOf)
  for (const term of terms) {
    const k = keyOf(term)
    if (!k) continue
    const i = keys.indexOf(k)
    if (i >= 0) return i
  }
  for (const term of terms) {
    const k = keyOf(term)
    if (k.length < 4) continue
    const i = keys.findIndex((h) => h && h.includes(k))
    if (i >= 0) return i
  }
  return -1
}

function sheetRows(worksheet) {
  const all = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  if (!all.length) return []
  let headerIdx = -1
  for (let i = 0; i < Math.min(all.length, 12); i++) {
    const keys = (all[i] || []).map(keyOf)
    const tieneNombre = keys.some((k) => [...CANON.nombres, ...CANON.razon, ...CANON.empresa].some((t) => keyOf(t) === k))
    const tieneDato = keys.some((k) => [...CANON.ci, ...CANON.correo, ...CANON.rif].some((t) => keyOf(t) === k))
    if (tieneNombre && tieneDato) { headerIdx = i; break }
  }
  if (headerIdx < 0) return []
  const headers = (all[headerIdx] || []).map(norm)
  const out = []
  for (let i = headerIdx + 1; i < all.length; i++) {
    const values = all[i] || []
    if (values.every((v) => !norm(v))) continue
    out.push({ headers, values })
  }
  return out
}

function normalizarFila({ headers, values }) {
  const get = (terms) => {
    const idx = findCol(headers, terms)
    return idx >= 0 ? norm(values[idx]) : ''
  }
  const nombresRaw = get(CANON.nombres)
  const razonSocial = get(CANON.razon)
  const apellidos = get(CANON.apellidos)
  const dni = digits(get(CANON.ci))
  const rif = get(CANON.rif).toUpperCase()
  const empresa = get(CANON.empresa)
  const email = primerEmail(get(CANON.correo))
  const telefono = get(CANON.telefono)
  const cargo = get(CANON.cargo)
  const categoria = get(CANON.categoria)
  const persona = lower(get(CANON.persona))

  const cat = lower(categoria)
  let afiliado = true
  let plan = 'individual'
  if (cat.includes('no afiliado') || cat.includes('noafiliad')) afiliado = false
  else if (cat.includes('corporativo') || cat.includes('juridic')) plan = 'corporativo'
  else if (cat.includes('individual')) plan = 'individual'

  const esJuridico =
    persona.includes('juridic') || Boolean(rif) ||
    (cat.includes('corporativo') && Boolean(empresa))

  const nombreFinal = nombresRaw || razonSocial || (esJuridico ? empresa : '')
  const empresaFinal = empresa || razonSocial || (esJuridico ? nombreFinal : '')
  const idUnico = dni || digits(rif) || ''

  if (!nombreFinal || !idUnico) return null

  return {
    nombres: nombreFinal.toUpperCase(),
    apellidos: apellidos.toUpperCase(),
    dni,
    cedula: dni,
    rif,
    empresa: empresaFinal.toUpperCase(),
    nombreEmpresa: empresaFinal.toUpperCase(),
    email,
    telefono,
    cargo: cargo.toUpperCase(),
    categoria,
    afiliado,
    plan,
    tipoPersona: esJuridico ? 'juridico' : 'natural',
    perfilAsistente: 'asistente'
  }
}

// Alta manual de un afiliado desde el módulo Afiliaciones.
// Si la persona ya existe, actualiza su perfil en vez de crear otro.
export async function createAffiliateManually({
  nombres, apellidos, dni, email, telefono, plan, empresa, rif, cargo
}) {
  const id = digits(dni) || digits(rif)
  if (!id) throw new Error('Indica la cédula o el RIF.')
  const emailFinal = String(email || '').trim().toLowerCase() || `cedula_${id}@avgh.local`
  const auth = getAuth(importApp)
  const snap = await get(ref(db, `${DB_ROOT}/users`))
  const users = snap.val() || {}
  const uidExistente = Object.entries(users).find(([, u]) =>
    (dni && digits(u?.dni || u?.cedula) === digits(dni)) ||
    (rif && String(u?.rif || '').toUpperCase() === String(rif).toUpperCase()) ||
    (email && String(u?.email || '').toLowerCase() === emailFinal)
  )?.[0]

  let uid = uidExistente
  if (!uid) {
    try {
      uid = (await createUserWithEmailAndPassword(auth, emailFinal, id)).user.uid
    } catch (e) {
      if (e?.code === 'auth/email-already-in-use') uid = `afiliado_${Date.now()}`
      else throw e
    }
  }

  const esCorporativo = plan === 'corporativo'
  const perfil = {
    nombres: String(nombres || '').toUpperCase(),
    apellidos: String(apellidos || '').toUpperCase(),
    dni: digits(dni),
    cedula: digits(dni),
    rif: String(rif || '').toUpperCase(),
    email: emailFinal,
    telefono: String(telefono || ''),
    empresa: String(empresa || '').toUpperCase(),
    nombreEmpresa: String(empresa || '').toUpperCase(),
    cargo: String(cargo || '').toUpperCase(),
    tipoPersona: esCorporativo ? 'juridico' : 'natural',
    afiliado: true,
    tipoAfiliacion: plan,
    planAfiliacion: plan,
    afiliadoDesde: users[uid]?.afiliadoDesde || Date.now(),
    fechaRegistro: users[uid]?.fechaRegistro || Date.now(),
    onboardingCompleted: true,
    perfilAsistente: 'asistente'
  }
  await update(ref(db, `${DB_ROOT}/users/${uid}`), perfil)
  return { uid, actualizado: Boolean(uidExistente) }
}

// Solo lee y mapea. No escribe en Firebase.
export function parsearExcelAfiliados({ arrayBuffer }) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const people = []
  const porHoja = {}
  for (const sheetName of workbook.SheetNames) {
    const filas = sheetRows(workbook.Sheets[sheetName])
    porHoja[sheetName.trim()] = filas.length
    for (const f of filas) {
      const p = normalizarFila(f)
      if (p) people.push({ ...p, hoja: sheetName.trim() })
    }
  }
  return { people, porHoja }
}

export function descargarPlantillaAfiliados() {
  const data = [
    { nombres: 'Juan', apellidos: 'Pérez', cedula: 'V-12345678', correo: 'juan@empresa.com', telefono: '0412-1234567', empresa: 'EMPRESA C.A.', cargo: 'Gerente', categoria: 'Afiliado Individual' },
    { 'razon social': 'INVERSIONES EJEMPLO C.A.', rif: 'J-12345678-9', correo: 'contacto@ejemplo.com', telefono: '0212-1234567', categoria: 'Afiliado Corporativo' }
  ]
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Afiliados')
  XLSX.writeFile(wb, 'Plantilla_Afiliados_AVGH.xlsx')
}

// Importa afiliados (naturales y jurídicos) evitando duplicados por cédula/RIF/correo.
export async function importarAfiliados({ arrayBuffer, actualizarExistentes = false, onProgress }) {
  const { people } = parsearExcelAfiliados({ arrayBuffer })
  if (!people.length) throw new Error('No se encontraron registros válidos (nombre/razón social + cédula o RIF).')

  const auth = getAuth(importApp)
  const created = []
  const actualizados = []
  const omitidos = []
  const errores = []
  let i = 0

  for (const p of people) {
    i++
    onProgress?.(`Procesando ${i} de ${people.length}...`)
    try {
      const usersSnap = await get(ref(db, `${DB_ROOT}/users`))
      const users = usersSnap.val() || {}
      let uid = null
      for (const [uId, u] of Object.entries(users)) {
        const uDni = digits(u.dni || u.cedula)
        const uRif = String(u.rif || '').toUpperCase()
        if ((p.email && lower(u.email) === p.email) ||
            (p.dni && uDni === p.dni) ||
            (p.rif && uRif === p.rif)) {
          uid = uId
          break
        }
      }

      const idCuenta = p.dni || digits(p.rif) || `sinci${Date.now()}${Math.floor(Math.random() * 1000)}`
      const emailFinal = p.email || `cedula_${idCuenta}@avgh.local`
      if (!uid) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, emailFinal, idCuenta)
          uid = cred.user.uid
        } catch (e) {
          if (e?.code === 'auth/email-already-in-use') {
            uid = `import_${Date.now()}_${Math.floor(Math.random() * 10000)}`
          } else throw e
        }
      } else if (!actualizarExistentes) {
        omitidos.push(p)
        continue
      }

      const userOld = users[uid] || {}
      const perfil = {
        ...userOld,
        nombres: p.nombres,
        apellidos: p.apellidos,
        dni: p.dni || userOld.dni || '',
        cedula: p.cedula || userOld.cedula || '',
        email: p.email || userOld.email || emailFinal,
        rif: p.rif || userOld.rif || '',
        empresa: p.empresa || userOld.empresa || '',
        nombreEmpresa: p.nombreEmpresa || userOld.nombreEmpresa || '',
        telefono: p.telefono || userOld.telefono || '',
        cargo: p.cargo || userOld.cargo || '',
        tipoPersona: p.tipoPersona,
        afiliado: p.afiliado,
        tipoAfiliacion: p.afiliado ? p.plan : '',
        planAfiliacion: p.afiliado ? p.plan : '',
        perfilAsistente: p.perfilAsistente,
        onboardingCompleted: true,
        afiliadoDesde: userOld.afiliadoDesde || (p.afiliado ? Date.now() : null),
        fechaRegistro: userOld.fechaRegistro || Date.now()
      }
      await update(ref(db, `${DB_ROOT}/users/${uid}`), perfil)
      if (actualizarExistentes) actualizados.push({ ...p, uid })
      else created.push({ ...p, uid })
    } catch (e) {
      console.error('Error importando afiliado', p, e)
      errores.push(`${p.nombres} ${p.apellidos}: ${e?.message || 'error'}`)
    }
  }

  return { created, actualizados, omitidos, errores, total: people.length }
}
