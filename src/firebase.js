import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth'

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

export const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)

// Raíz de datos de la app AVGH. Todos los datos viven bajo este nodo para
// no interferir con el proyecto SGF-IP (que usa el nodo appData_imagen_V9).
export const DB_ROOT = 'avgh'

let _auth = null
let _authError = null

export function getAuthSafe() {
  if (_authError) return null
  if (_auth) return _auth
  try {
    _auth = initializeAuth(app, {
      persistence: inMemoryPersistence
    })
  } catch (e) {
    try {
      _auth = getAuth(app)
    } catch (err) {
      _authError = err
      return null
    }
  }
  return _auth
}

export const authReady = () => !_authError && !!_auth