import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword
} from 'firebase/auth'
import { ref, set, update, get, onValue, off } from 'firebase/database'
import { db, DB_ROOT, getAuthSafe } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const auth = getAuthSafe()

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return undefined
    }
    const unsubscribe = onAuthStateChanged(
      auth,
      (fbUser) => {
        setUser(fbUser)
        setLoading(false)
      },
      () => {
        setLoading(false)
      }
    )
    return unsubscribe
  }, [auth])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return undefined
    }
    const profileRef = ref(db, `${DB_ROOT}/users/${user.uid}`)
    const handler = onValue(
      profileRef,
      (snap) => {
        const data = snap.val() || null
        setProfile(data)
        if (data?.bloqueado === true) {
          setBlocked(true)
          setLoading(false)
          if (auth) {
            signOut(auth).catch(() => {})
          }
        } else {
          setBlocked(false)
          if (!data) setLoading(false)
        }
      },
      () => {
        setProfile(null)
        setLoading(false)
      }
    )
    return () => off(profileRef, 'value', handler)
  }, [user, auth])

  // Los empleados inscritos por la empresa se guardaban bajo un uid sintético
  // (emp_<cedula>). Al crear su cuenta real de Auth hay que mover inscripciones,
  // facturas y certificados a ese uid para que el perfil vea todo.
  const migrateLegacyData = async ({ toUid, dni, fromUids = [] }) => {
    try {
      const [insSnap, facSnap] = await Promise.all([
        get(ref(db, `${DB_ROOT}/inscripciones`)),
        get(ref(db, `${DB_ROOT}/facturas`))
      ])
      const ins = insSnap.val() || {}
      const fac = facSnap.val() || {}
      const sources = new Set(fromUids.filter(Boolean))
      const digits = (dni || '').replace(/\D/g, '')
      for (const [uid, acts] of Object.entries(ins)) {
        if (uid.startsWith(`emp_${digits}`)) sources.add(uid)
        const first = Object.values(acts || {})[0]
        const d = String(first?.user?.dni || first?.user?.cedula || '').replace(/\D/g, '')
        if (digits && d === digits) sources.add(uid)
      }
      const updates = {}
      for (const from of sources) {
        if (!from || from === toUid) continue
        for (const [node, store] of [['inscripciones', ins], ['facturas', fac]]) {
          const dataNode = store[from]
          if (!dataNode) continue
          for (const [key, value] of Object.entries(dataNode)) {
            updates[`${DB_ROOT}/${node}/${toUid}/${key}`] = value
            updates[`${DB_ROOT}/${node}/${from}/${key}`] = null
          }
        }
      }
      if (Object.keys(updates).length) await update(ref(db, '/'), updates)
    } catch (e) {
      console.warn('No se pudieron migrar datos anteriores:', e)
    }
  }

  const login = async (identifier, password) => {
    const currentAuth = getAuthSafe()
    if (!currentAuth) throw new Error('auth-unavailable')
    const cleanId = identifier.trim()
    const cleanDni = cleanId.replace(/\D/g, '')
    const cleanPassDni = (password || '').replace(/\D/g, '')

    // 1. Si es email directo, intentar login inmediato sin lecturas previas a DB que fallen por reglas de seguridad
    const possibleEmails = []
    if (cleanId.includes('@')) {
      possibleEmails.push(cleanId.toLowerCase())
    } else {
      possibleEmails.push(`cedula_${cleanDni}@avgh.local`)
    }

    let lastError = null
    for (const emailTry of possibleEmails) {
      try {
        await signInWithEmailAndPassword(currentAuth, emailTry, password)
        if (!cleanId.includes('@')) {
          await migrateLegacyData({
            toUid: currentAuth.currentUser?.uid,
            dni: cleanDni,
            fromUids: [`emp_${cleanDni}`]
          })
        }
        return // ¡Inicio de sesión exitoso!
      } catch (err) {
        lastError = err
      }
    }

    // 2. Si falló con el email sintético por cédula, intentar buscar en DB si tiene un email personalizado registrado
    if (!cleanId.includes('@')) {
      try {
        const usersSnap = await get(ref(db, `${DB_ROOT}/users`))
        const allUsers = usersSnap.val() || {}
        for (const [, u] of Object.entries(allUsers)) {
          if (String(u.dni || '').trim() === cleanDni || String(u.cedula || '').trim() === cleanDni) {
            if (u.email && !possibleEmails.includes(u.email.trim().toLowerCase())) {
              try {
                await signInWithEmailAndPassword(currentAuth, u.email.trim().toLowerCase(), password)
                await migrateLegacyData({
                  toUid: currentAuth.currentUser?.uid,
                  dni: cleanDni,
                  fromUids: [`emp_${cleanDni}`]
                })
                return
              } catch (e) {
                lastError = e
              }
            }
          }
        }
      } catch {
        /* ignore db read errors if rules block it */
      }
    }

    // 3. Si aún no existe cuenta en Auth para este empleado registrado por empresa, intentamos registrarlo/crearlo automáticamente en Auth con la clave provista
    if (!cleanId.includes('@')) {
      try {
        const compSnap = await get(ref(db, `${DB_ROOT}/companies`))
        const allCompanies = compSnap.val() || {}
        for (const [compUid, comp] of Object.entries(allCompanies)) {
          const emps = comp.employees || {}
          for (const [, emp] of Object.entries(emps)) {
            if (String(emp.dni || '').trim().replace(/\D/g, '') === cleanDni) {
              const empEmail = (emp.email && emp.email.includes('@') && !emp.email.includes('@avgh.local')) 
                ? emp.email.toLowerCase() 
                : `cedula_${cleanDni}@avgh.local`
              try {
                // Intentar crear la cuenta en Auth para este empleado por primera vez
                const newCred = await createUserWithEmailAndPassword(currentAuth, empEmail, password)
                const uid = newCred.user.uid
                // Crear su perfil de usuario en /users para que tenga acceso completo
                await set(ref(db, `${DB_ROOT}/users/${uid}`), {
                  nombres: emp.nombres || '',
                  apellidos: emp.apellidos || '',
                  dni: emp.dni || '',
                  email: empEmail,
                  cargo: emp.cargo || '',
                  empresa: comp.nombreEmpresa || '',
                  tipoPersona: 'natural',
                  afiliado: true,
                  uidOrigen: `emp_${cleanDni}`,
                  fechaRegistro: Date.now()
                })
                await migrateLegacyData({ toUid: uid, dni: cleanDni, fromUids: [`emp_${cleanDni}`] })
                return
              } catch (createErr) {
                // Si el correo ya estaba en use, intentamos simplemente hacer signIn
                if (codeOf(createErr) === 'auth/email-already-in-use') {
                  try {
                    await signInWithEmailAndPassword(currentAuth, empEmail, password)
                    await migrateLegacyData({
                      toUid: currentAuth.currentUser?.uid,
                      dni: cleanDni,
                      fromUids: [`emp_${cleanDni}`]
                    })
                    return
                  } catch (e) {
                    lastError = e
                  }
                } else {
                  lastError = createErr
                }
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    // 4. Inscritos registrados por el admin: si nunca se creó su cuenta en Auth,
    // la activamos usando la cédula como clave por defecto.
    if (!cleanId.includes('@') && cleanPassDni === cleanDni && cleanDni.length >= 4) {
      try {
        const [usersSnap, inscSnap] = await Promise.all([
          get(ref(db, `${DB_ROOT}/users`)),
          get(ref(db, `${DB_ROOT}/inscripciones`))
        ])
        let foundUser = null
        const allUsers = usersSnap.val() || {}
        for (const [uid, u] of Object.entries(allUsers)) {
          const d = String(u?.dni || u?.cedula || '').replace(/\D/g, '')
          if (d === cleanDni) {
            foundUser = { uid, data: u }
            break
          }
        }
        if (!foundUser) {
          const ins = inscSnap.val() || {}
          for (const [uid, acts] of Object.entries(ins)) {
            const first = Object.values(acts || {})[0]
            const u = first?.user || {}
            const d = String(u.dni || u.cedula || '').replace(/\D/g, '')
            if (d === cleanDni) {
              foundUser = { uid, data: u }
              break
            }
          }
        }
        if (foundUser) {
          const u = foundUser.data || {}
          const email = u.email && u.email.includes('@') && !u.email.includes('@avgh.local')
            ? u.email.toLowerCase()
            : `cedula_${cleanDni}@avgh.local`
          try {
            const cred = await createUserWithEmailAndPassword(currentAuth, email, password)
            await set(ref(db, `${DB_ROOT}/users/${cred.user.uid}`), {
              ...u,
              dni: u.dni || cleanDni,
              email,
              uidOrigen: foundUser.uid || '',
              fechaRegistro: u.fechaRegistro || Date.now()
            })
            await migrateLegacyData({
              toUid: cred.user.uid,
              dni: cleanDni,
              fromUids: [foundUser.uid, `emp_${cleanDni}`]
            })
            return
          } catch (createErr) {
            if (codeOf(createErr) === 'auth/email-already-in-use') {
              await signInWithEmailAndPassword(currentAuth, email, password)
              await migrateLegacyData({
                toUid: currentAuth.currentUser?.uid,
                dni: cleanDni,
                fromUids: [foundUser.uid, `emp_${cleanDni}`]
              })
              return
            }
            lastError = createErr
          }
        }
      } catch {
        /* ignore */
      }
    }

    throw lastError || new Error('auth/user-not-found')
  }

  const register = async (data) => {
    const currentAuth = getAuthSafe()
    if (!currentAuth) throw new Error('auth-unavailable')
    const { dni, password, email, ...profileData } = data
    const cleanDni = (dni || '').trim().replace(/\D/g, '')
    const userEmail = (email || '').trim().toLowerCase() || `cedula_${cleanDni}@avgh.local`

    let cred
    try {
      cred = await createUserWithEmailAndPassword(currentAuth, userEmail, password)
    } catch (err) {
      if (codeOf(err) === 'auth/email-already-in-use') {
        // Si el correo ya existe en Auth, intentamos iniciar sesión con él y actualizar su perfil
        const signCred = await signInWithEmailAndPassword(currentAuth, userEmail, password)
        const uid = signCred.user.uid
        const safe = { ...profileData }
        delete safe.confirm
        const updates = {
          ...safe,
          dni: dni ? dni.trim() : '',
          email: userEmail,
          fechaRegistro: profileData.fechaRegistro || Date.now()
        }
        // No sobrescribir el estatus de afiliado de una cuenta existente si el
        // formulario de registro no envía una decisión explícita.
        if (typeof data.afiliado === 'boolean') updates.afiliado = data.afiliado
        await update(ref(db, `${DB_ROOT}/users/${uid}`), updates)
        return signCred.user
      }
      throw err
    }

    const uid = cred.user.uid
    const safe = { ...profileData }
    delete safe.confirm
    await set(ref(db, `${DB_ROOT}/users/${uid}`), {
      ...safe,
      dni: dni ? dni.trim() : '',
      email: userEmail,
      afiliado: data.afiliado === true,
      fechaRegistro: Date.now()
    })
    return cred.user
  }

  const logout = async () => {
    const currentAuth = getAuthSafe()
    if (currentAuth) await signOut(currentAuth)
  }

  const sendReset = async (email) => {
    const currentAuth = getAuthSafe()
    if (!currentAuth) throw new Error('auth-unavailable')
    await sendPasswordResetEmail(currentAuth, email.trim())
  }

  const changePassword = async (currentPassword, newPassword) => {
    const currentAuth = getAuthSafe()
    if (!currentAuth || !currentAuth.currentUser) throw new Error('auth-unavailable')
    const email = currentAuth.currentUser.email
    if (!email) throw new Error('auth/no-email')
    const credential = EmailAuthProvider.credential(email, currentPassword)
    await reauthenticateWithCredential(currentAuth.currentUser, credential)
    await updatePassword(currentAuth.currentUser, newPassword)
  }

  const updateProfileData = async (fields) => {
    if (!user) throw new Error('No session')
    if (fields.email && auth && auth.currentUser) {
      try {
        await updateEmail(auth.currentUser, fields.email.trim().toLowerCase())
      } catch (err) {
        // Si requiere reautenticación o el email ya está en uso, dejamos que actualice en DB pero informamos o manejamos
        console.warn('Could not update Auth email:', err)
      }
    }
    await update(ref(db, `${DB_ROOT}/users/${user.uid}`), fields)
  }

  const clearBlocked = () => setBlocked(false)

  const value = useMemo(
    () => ({
      user,
      profile,
      blocked,
      loading,
      authAvailable: !!auth,
      login,
      register,
      logout,
      sendReset,
      changePassword,
      updateProfileData,
      clearBlocked
    }),
    [user, profile, blocked, loading, auth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)