// Crea la cuenta de administrador de AVGH:
//   1) Registra el correo/contraseña en Firebase Authentication
//   2) Marca el perfil como rol:"admin" en avgh/users/{uid}
// Uso:
//   node scripts/create-admin.mjs admin@avgh.org "MiClave123"
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, set } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyDjYv5Ykna1SqhUtbjn2FAnFNeNg371kaE',
  authDomain: 'avgh-af453.firebaseapp.com',
  projectId: 'avgh-af453',
  storageBucket: 'avgh-af453.firebasestorage.app',
  messagingSenderId: '417342855364',
  appId: '1:417342855364:web:2721aa915c74a90bb15191',
  measurementId: 'G-0LSTZH0C4T',
  databaseURL: 'https://avgh-af453-default-rtdb.firebaseio.com'
}

let [email, password] = process.argv.slice(2)
email = (email || '').trim()
password = password || ''

if (!email || !password) {
  const rl = createInterface({ input: stdin, output: stdout })
  if (!email) email = (await rl.question('Correo del administrador (ej. admin@avgh.org): ')).trim()
  if (!password) password = await rl.question('Contraseña (mínimo 6 caracteres): ')
  rl.close()
}

if (!email || !password) {
  console.error('Debes indicar correo y contraseña.')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app)

console.log('1) Creando la cuenta en Firebase Authentication...')
let cred
try {
  cred = await createUserWithEmailAndPassword(auth, email, password)
} catch (err) {
  if (err?.code === 'auth/email-already-in-use') {
    console.error(`Ya existe una cuenta con ${email}. Verifica el rol en avgh/users/{uid} (debería tener "rol":"admin").`)
  } else {
    console.error('Error al crear la cuenta:', err?.message || err)
  }
  process.exit(1)
}

const uid = cred.user.uid
console.log('   -> creado, uid:', uid)

console.log('2) Marcando perfil como rol=admin...')
await set(ref(db, `avgh/users/${uid}`), {
  nombres: 'Administrador',
  apellidos: 'AVGH',
  email: email.toLowerCase(),
  telefono: '',
  dni: '',
  afiliado: true,
  rol: 'admin',
  fechaRegistro: Date.now()
})
console.log('✅ Listo. La cuenta de administrador es:', email.toLowerCase())
console.log('   Entra a la app y abre: Acceso administrador (al pie de página).')
process.exit(0)