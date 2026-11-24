import * as XLSX from 'xlsx'
import { initializeApp, getApps } from 'firebase/app'
import { ref, get, update } from 'firebase/database'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { db, DB_ROOT, firebaseConfig } from '../firebase'
import { createInscription } from './useData'

// App secundaria para crear cuentas sin desloguear al admin que está importando.
const IMPORT_APP_NAME = 'avgh-import'
const importApp = getApps().find((a) => a.name === IMPORT_APP_NAME) || initializeApp(firebaseConfig, IMPORT_APP_NAME)

// Convierte números de Excel (día serial) a timestamp JS.
function excelDateToTs(value) {
  if (value === '' || value == null) return Date.now()
  if (typeof value === 'number') {
    // Excel cuenta desde 1899-12-30 (ajuste por leap year de 1900)
    return Math.round((value - 25569) * 86400 * 1000)
  }
  const n = Number(value)
  if (!Number.isNaN(n) && n > 30000) return Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? Date.now() : d.getTime()
}

const norm = (v) => String(v ?? '').trim()
const lower = (v) => norm(v).toLowerCase()

// Mapea la CATEGORÍA del Excel a tipoAsistente + datos de afiliación.
export function mapCategoria(cat) {
  const c = lower(cat)
  if (c.includes('corporativo')) {
    return { tipoAsistente: 'afiliado', afiliado: true, planAfiliacion: 'corporativo', perfilAsistente: 'asistente' }
  }
  if (c.includes('individual')) {
    return { tipoAsistente: 'afiliado', afiliado: true, planAfiliacion: 'individual', perfilAsistente: 'asistente' }
  }
  if (c.includes('afiliado')) {
    return { tipoAsistente: 'afiliado', afiliado: true, planAfiliacion: 'individual', perfilAsistente: 'asistente' }
  }
  if (c.includes('no afiliado') || c.includes('noafiliado')) {
    return { tipoAsistente: 'regular', afiliado: false, planAfiliacion: '', perfilAsistente: 'asistente' }
  }
  if (c.includes('junta')) {
    return { tipoAsistente: 'junta', afiliado: true, planAfiliacion: 'corporativo', perfilAsistente: 'junta' }
  }
  if (c.includes('facilitad')) {
    return { tipoAsistente: 'facilitador', afiliado: true, planAfiliacion: 'corporativo', perfilAsistente: 'facilitador' }
  }
  if (c.includes('patrocin')) {
    return { tipoAsistente: 'invitado', afiliado: false, planAfiliacion: '', perfilAsistente: 'asistente' }
  }
  if (c.includes('invitad')) {
    return { tipoAsistente: 'invitado', afiliado: false, planAfiliacion: '', perfilAsistente: 'asistente' }
  }
  return { tipoAsistente: 'regular', afiliado: false, planAfiliacion: '', perfilAsistente: 'asistente' }
}

const findCol = (headers, terms) => {
  // Para términos cortos como "ci", exigir coincidencia exacta para no
  // capturar "FECHA DE INSCRIPCION" (que contiene "ci").
  const exact = ['ci', 'dni', 'cedula', 'cédula', 'documento', 'correo', 'email', 'mail', 'empresa', 'cargo', 'telefono', 'teléfono', 'wts', 'whatsapp', 'celular', 'categoria', 'categoría', 'tipo', 'pago', 'pagos', 'estatus', 'estado', 'nombre', 'nombres', 'apellido', 'apellidos']
  for (const term of terms) {
    const t = lower(term)
    if (exact.includes(t)) {
      const i = headers.findIndex((h) => lower(h) === t)
      if (i >= 0) return i
    }
  }
  const idx = headers.findIndex((h) => terms.some((t) => lower(h).includes(lower(t))))
  return idx >= 0 ? idx : -1
}

// Extrae filas de una hoja: detecta la fila de encabezados y mapea a objeto.
function sheetRows(worksheet) {
  const all = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
  if (!all.length) return []

  // Buscar fila de encabezados (la que contenga NOMBRE y CI/CEDULA)
  let headerIdx = -1
  for (let i = 0; i < Math.min(all.length, 8); i++) {
    const row = all[i].map(norm)
    if (row.some((h) => lower(h).includes('nombre')) && row.some((h) => /^(ci|cedula|cédula|dni|documento)$/i.test(lower(h)) || lower(h).includes('cedula'))) {
      headerIdx = i
      break
    }
  }
  // Formato plantilla simple (primera fila = headers nombres/apellidos/dni)
  if (headerIdx < 0 && all[0].some((h) => lower(h).includes('nombre'))) headerIdx = 0
  if (headerIdx < 0) return []

  const headers = all[headerIdx].map(norm)
  const out = []
  for (let i = headerIdx + 1; i < all.length; i++) {
    const r = all[i]
    if (!r || r.every((v) => !norm(v))) continue
    const row = {}
    headers.forEach((h, j) => { if (h) row[h] = r[j] })
    out.push({ row, headers })
  }
  return out
}

function normalizarFila({ row, headers }, actividad) {
  const get = (terms) => {
    const idx = findCol(headers, terms)
    return idx >= 0 ? norm(row[idx] ?? row[headers[idx]]) : ''
  }

  const nombres = get(['nombre', 'nombres']) || (lower(actividad?.titulo) ? '' : '')
  const apellidos = get(['apellido', 'apellidos', 'nombre apellidos'])
  const dniRaw = get(['ci', 'cedula', 'cédula', 'dni', 'documento'])
  const dni = dniRaw.replace(/\D/g, '')
  const email = get(['correo', 'email', 'mail']).toLowerCase()
  const telefono = get(['telefono', 'teléfono', 'wts', 'whatsapp', 'celular'])
  const empresa = get(['empresa', 'compania', 'compañía'])
  const cargo = get(['cargo'])
  const categoria = get(['categoria', 'categoría', 'tipo'])
  const pagoRaw = get(['pago', 'pagos', 'estatus', 'estado'])
  const pagado = !pagoRaw || lower(pagoRaw).includes('pagado') && !lower(pagoRaw).includes('por pagar')

  // "NOMBRE APELLIDOS" a veces viene junto en la columna de apellidos
  let apellidosFinal = apellidos
  let nombresFinal = nombres
  if (!nombresFinal && apellidos.includes(' ')) {
    const partes = apellidos.trim().split(/\s+/)
    nombresFinal = partes.shift()
    apellidosFinal = partes.join(' ')
  }

  const meta = mapCategoria(categoria)
  const fechaRaw = get(['fecha de inscripcion', 'fecha inscripcion', 'fecha'])
  const fechaInscripcion = excelDateToTs(fechaRaw)

  if (!nombresFinal) return null
  return {
    tieneFecha: Boolean(String(fechaRaw ?? '').trim()),
    nombres: nombresFinal.toUpperCase(),
    apellidos: apellidosFinal.toUpperCase(),
    dni,
    email,
    telefono,
    empresa,
    cargo,
    categoria,
    pagado,
    fechaInscripcion,
    ...meta
  }
}

// Solo lee y mapea el archivo: no escribe nada en Firebase. Útil para probar.
export function parsearExcelInscritos({ arrayBuffer }) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const people = []
  const porHoja = {}

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    const filas = sheetRows(ws)
    porHoja[sheetName.trim()] = filas.length
    for (const f of filas) {
      const p = normalizarFila(f)
      if (p) people.push({ ...p, hoja: sheetName.trim() })
    }
  }
  return { people, porHoja }
}

// Procesa el archivo completo (todas las hojas) y crea personas + inscripciones.
export async function importarExcelInscritos({ arrayBuffer, actividad, onProgress, actualizarExistentes = false }) {
  const { people } = parsearExcelInscritos({ arrayBuffer })

  if (!people.length) throw new Error('No se encontraron registros válidos (nombre + cédula).')

  const auth = getAuth(importApp)
  const created = []
  const actualizados = []
  const yaInscritos = []
  const errores = []
  let i = 0
  for (const p of people) {
    i++
    onProgress?.(`${actualizarExistentes ? 'Actualizando' : 'Procesando'} ${i} de ${people.length}...`)
    try {
      // Buscar usuario existente por email o por dni en /users
      let uid = null
      const usersSnap = await get(ref(db, `${DB_ROOT}/users`))
      const users = usersSnap.val() || {}
      for (const [uId, u] of Object.entries(users)) {
        if ((p.email && lower(u.email) === p.email) || String(u.dni || '').replace(/\D/g, '') === p.dni) {
          uid = uId
          break
        }
      }

      const dniParaCuenta = p.dni || `sinci${Date.now()}${Math.floor(Math.random() * 1000)}`
      const emailFinal = p.email || `${dniParaCuenta}@avgh.local`
      const passwordInicial = p.dni || dniParaCuenta
      if (!uid) {
        // Crear cuenta con clave = cédula (o uid temporal si no tiene cédula)
        try {
          const cred = await createUserWithEmailAndPassword(auth, emailFinal, passwordInicial)
          uid = cred.user.uid
        } catch (e) {
          if (e?.code === 'auth/email-already-in-use') {
            uid = `import_${Date.now()}_${Math.floor(Math.random() * 10000)}`
          } else throw e
        }
      }

      // Si ya está inscrito en esta actividad, por defecto se omite para no
      // generar facturas duplicadas. Con actualizarExistentes se reutiliza la
      // factura original (mismo id y número) y se conserva lo que no trae el Excel.
      const userOld = uid ? users[uid] || null : null
      let reutilizar = null
      if (uid && actividad?.id) {
        const inscRef = ref(db, `${DB_ROOT}/inscripciones/${uid}/${actividad.id}`)
        const inscSnap = await get(inscRef)
        if (inscSnap.exists()) {
          if (!actualizarExistentes) {
            yaInscritos.push({ uid, ...p })
            continue
          }
          const inscOld = inscSnap.val() || {}
          let facturaOld = null
          if (inscOld.facturaId) {
            const facSnap = await get(ref(db, `${DB_ROOT}/facturas/${uid}/${inscOld.facturaId}`))
            facturaOld = facSnap.val() || null
          }
          reutilizar = { inscripcion: inscOld, factura: facturaOld }
        }
      }

      const perfil = {
        nombres: p.nombres,
        apellidos: p.apellidos,
        afiliado: p.afiliado,
        tipoAfiliacion: p.planAfiliacion,
        planAfiliacion: p.planAfiliacion,
        perfilAsistente: p.perfilAsistente,
        tipoPersona: p.planAfiliacion === 'corporativo' ? 'juridico' : 'natural',
        fechaRegistro: p.tieneFecha
          ? p.fechaInscripcion
          : userOld?.fechaRegistro || p.fechaInscripcion
      }
      // Solo sobrescribir campos que realmente vienen en el Excel, para no
      // borrar datos ya existentes (email, cédula, teléfono, empresa...).
      if (p.dni) perfil.dni = p.dni
      if (p.email) perfil.email = emailFinal
      if (p.telefono) perfil.telefono = p.telefono
      if (p.empresa) { perfil.empresa = p.empresa; perfil.nombreEmpresa = p.empresa }
      if (p.cargo) perfil.cargo = p.cargo
      await update(ref(db, `${DB_ROOT}/users/${uid}`), perfil)

      const userFinal = reutilizar?.inscripcion?.user
        ? { ...reutilizar.inscripcion.user, ...perfil }
        : perfil
      await createInscription({
        uid,
        actividad,
        user: userFinal,
        metodoPago: p.pagado ? 'cash' : 'pendiente',
        estado: p.pagado ? 'confirmada' : 'pendiente',
        tipoAsistente: p.tipoAsistente,
        afiliado: p.afiliado,
        planAfiliacion: p.planAfiliacion,
        monto: p.pagado ? (Number(actividad?.precio) || 0) : 0,
        reutilizar
      })
      if (reutilizar) actualizados.push({ uid, ...p })
      else created.push({ uid, ...p })
    } catch (e) {
      console.error('Error importando fila', p, e)
      errores.push(`${p.nombres} ${p.apellidos}: ${e?.message || 'error'}`)
    }
  }

  return { created, actualizados, yaInscritos, errores, total: people.length }
}
