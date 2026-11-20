import { useEffect, useState } from 'react'
import { FaMobileScreenButton, FaXmark } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { requestNotificationPermission } from '../utils/permissions'

export default function PwaInstallBanner() {
  const { t } = useLang()
  const [deferred, setDeferred] = useState(null)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [notifState, setNotifState] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [notifMsg, setNotifMsg] = useState('')

  const enableNotifications = async () => {
    const res = await requestNotificationPermission()
    setNotifState(res.state)
    setNotifMsg(res.message)
  }

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferred(e)
      setVisible(true)
    }
    const installedHandler = () => setVisible(false)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    // Fallback: si el navegador no dispara el evento pero estamos en móvil, lo mostramos igual
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches
    if (!isStandalone) {
      const ua = navigator.userAgent
      const ios = /iphone|ipad|ipod/i.test(ua) && !window.MSStream
      if (ios) setIsIOS(true)
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
        window.removeEventListener('appinstalled', installedHandler)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (!visible) return null

  const install = async () => {
    if (isIOS) {
      alert(t('banner.iosHint') || 'Para instalar en iPhone/iPad: Presiona el botón Compartir y selecciona "Agregar a estantería / pantalla de inicio".')
      return
    }
    if (deferred) {
      try {
        deferred.prompt()
        const choiceResult = await deferred.userChoice
        if (choiceResult.outcome === 'accepted') {
          setDeferred(null)
          setVisible(false)
        }
      } catch (err) {
        console.error('Prompt error:', err)
      }
      return
    }

    // Si deferred no está listo, disparamos un evento simulado o intentamos invocar el prompt global si el navegador lo permite
    window.dispatchEvent(new Event('beforeinstallprompt'))
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt()
      return
    }

    // Si aún así el navegador bloquea el prompt automático, abrimos la opción nativa de la ventana si existe
    if (window.navigator && window.navigator.share) {
      try {
        await window.navigator.share({ title: 'AVGH App', url: window.location.href })
        return
      } catch {
        /* ignore */
      }
    }

    // Último recurso: intentar invocar el instalador si el navegador expone install
    const userAgent = navigator.userAgent.toLowerCase()
    if (/android/.test(userAgent)) {
      alert('Para instalar la aplicación en tu celular:\n\n1. Toca el menú de los 3 puntos (⋮) arriba a la derecha en tu navegador.\n2. Selecciona "Instalar aplicación" o "Agregar a la pantalla principal".')
    } else {
      alert('Para instalar la aplicación:\n\nAbre el menú de opciones de tu navegador y selecciona "Instalar aplicación".')
    }
  }

  return (
    <div className="install-banner">
      <FaMobileScreenButton className="install-icon" />
      <p>{t('banner.text')}</p>
      <div className="install-actions">
        <button className="btn btn-primary" onClick={install}>
          {t('banner.install')}
        </button>
        {notifState !== 'granted' ? (
          <button className="btn btn-outline" onClick={enableNotifications}>
            {t('banner.enableNotifications')}
          </button>
        ) : (
          <span className="install-ok">✓ {t('banner.notificationsOn')}</span>
        )}
        <button className="install-close" aria-label="Cerrar" onClick={() => setVisible(false)}>
          <FaXmark />
        </button>
      </div>
      {notifMsg && <p className="install-hint">{notifMsg}</p>}
      {!notifMsg && notifState !== 'granted' && (
        <p className="install-hint">{t('banner.notificationsHint')}</p>
      )}
    </div>
  )
}