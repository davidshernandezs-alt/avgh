// Utilidades para pedir permisos del navegador de forma segura y compatible.
// Los permisos SOLO pueden pedirse desde un gesto del usuario (clic) y en
// contexto seguro (HTTPS o localhost). Si el navegador no muestra el diálogo,
// damos instrucciones claras en vez de fallar en silencio.

export const isSecureContextOk = () =>
  typeof window !== 'undefined' && window.isSecureContext === true

export function cameraSupport() {
  const hasApi =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'

  if (!isSecureContextOk()) {
    return {
      ok: false,
      reason: 'insecure',
      message: 'La cámara requiere HTTPS. Abre la app por el enlace de Vercel (https://) o usa localhost en la computadora.'
    }
  }
  if (!hasApi) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Este navegador no permite usar la cámara. Prueba con Chrome o Safari actualizado.'
    }
  }
  return { ok: true }
}

export function notificationSupport() {
  const hasApi = typeof window !== 'undefined' && 'Notification' in window
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches))

  if (!isSecureContextOk()) {
    return { ok: false, reason: 'insecure', isIOS, isStandalone, hasApi, message: 'Las notificaciones requieren HTTPS.' }
  }
  if (!hasApi) {
    return { ok: false, reason: 'unsupported', isIOS, isStandalone, hasApi, message: 'Este navegador no admite notificaciones.' }
  }
  if (isIOS && !isStandalone) {
    return {
      ok: false,
      reason: 'ios-not-installed',
      isIOS,
      isStandalone,
      hasApi,
      message: 'En iPhone/iPad, agrega la app a la pantalla de inicio y vuelve a intentar (iOS 16.4 o superior).'
    }
  }
  return { ok: true, isIOS, isStandalone, hasApi }
}

export async function requestNotificationPermission() {
  const support = notificationSupport()
  if (!support.ok) return { state: support.reason, message: support.message }

  let permission = Notification.permission
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission()
    } catch {
      permission = Notification.permission
    }
  }

  if (permission === 'granted') {
    // En móvil, las notificaciones de una PWA deben mostrarse a través del service worker.
    try {
      const reg = await navigator.serviceWorker?.ready
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification('AVGH', {
          body: 'Notificaciones activadas correctamente.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png'
        })
      }
    } catch {
      /* ignore */
    }
    return { state: 'granted', message: 'Notificaciones activadas correctamente.' }
  }

  if (permission === 'denied') {
    return {
      state: 'denied',
      message: 'Permiso denegado. Actívalo en Ajustes del navegador → Permisos → Notificaciones (o reinstala la app).'
    }
  }
  return { state: permission, message: 'No se concedió el permiso de notificaciones.' }
}
