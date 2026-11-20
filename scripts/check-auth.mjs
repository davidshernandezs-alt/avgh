import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

const app = initializeApp({
  apiKey: 'AIzaSyDmtI70sEjbB6k3tkgtVuSYHBclDh6tiLE',
  authDomain: 'mi-portal-84bd1.firebaseapp.com',
  projectId: 'mi-portal-84bd1',
  storageBucket: 'mi-portal-84bd1.firebasestorage.app',
  messagingSenderId: '153791649699',
  appId: '1:153791649699:web:a3db5d540b874168b1ec16',
  measurementId: 'G-23QLTK5ZGZ',
  databaseURL: 'https://mi-portal-84bd1-default-rtdb.firebaseio.com/'
})

try {
  await signInWithEmailAndPassword(getAuth(app), 'noexiste@test.test', 'x12345678')
  console.log('RESULTADO: inesperado (login exitoso)')
} catch (e) {
  console.log('Error code:', e.code)
  if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
    console.log('RESULTADO: Email/Password HABILITADO (el proveedor responde)')
  } else {
    console.log('RESULTADO: Posiblemente NO habilitado ->', e.message)
  }
}
process.exit(0)