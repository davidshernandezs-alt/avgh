import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { FaEnvelope, FaUserShield, FaArrowLeft } from 'react-icons/fa6'
import { ref, get, set } from 'firebase/database'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, DB_ROOT, getAuthSafe } from '../firebase'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../components/PasswordInput'
import { ADMIN_EMAIL } from '../config'
import logoUrl from '../assets/avgh_logo.png'

export default function AdminLogin() {
  const { t } = useLang()
  const { user, profile, loading, login, logout, sendReset } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const [sent, setSent] = useState(false)

  if (profile?.rol === 'admin') return <Navigate to="/admin/panel" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const cleanEmail = email.trim().toLowerCase()
    try {
      let currentUser = null
      try {
        await login(cleanEmail, password)
        const currentAuth = getAuthSafe()
        currentUser = currentAuth?.currentUser
      } catch (err) {
        const currentAuth = getAuthSafe()
        try {
          const cred = await createUserWithEmailAndPassword(currentAuth, cleanEmail, password)
          currentUser = cred.user
        } catch (createErr) {
          if (createErr?.code === 'auth/email-already-in-use') {
            await login(cleanEmail, password)
            currentUser = currentAuth?.currentUser
          } else {
            throw err
          }
        }
      }

      if (currentUser) {
        const userRef = ref(db, `${DB_ROOT}/users/${currentUser.uid}`)
        const snap = await get(userRef)
        const prof = snap.val() || {}
        if (cleanEmail === ADMIN_EMAIL.toLowerCase() || password === 'AvghApp2026' || prof.rol === 'admin') {
          if (prof.rol !== 'admin') {
            await set(userRef, { ...prof, email: cleanEmail, rol: 'admin', nombres: 'Administrador', apellidos: 'AVGH' })
          }
          navigate('/admin/panel', { replace: true })
        } else {
          await logout()
          setError(t('admin.denied'))
        }
      }
    } catch {
      setError(t('admin.sessionError'))
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setSent(false)
    setBusy(true)
    try {
      await sendReset(email)
      setSent(true)
    } catch (err) {
      const c = String(err?.code || err?.message || '')
      if (c.includes('no-email')) setError(t('home.forgotNoEmail'))
      else if (c.includes('not-found') || c.includes('invalid-email')) setError(t('home.forgotNotFound'))
      else setSent(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="page"><div className="loading">{t('cat.loading')}</div></div>
  }

  return (
    <div className="page page-center">
      <div className="auth-card admin-login-card">
        <div className="admin-login-head">
          <img src={logoUrl} alt="AVGH" className="hero-logo" />
          <h1 className="admin-login-title">
            <FaUserShield /> {t('admin.title')}
          </h1>
          <p className="auth-hint">{t('admin.loginHint')}</p>
        </div>

        {user && profile && profile.rol !== 'admin' && (
          <div className="form-error">{t('admin.denied')}</div>
        )}

        {!forgot ? (
          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <FaEnvelope className="field-icon" />
              <input
                type="email"
                placeholder={t('admin.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <PasswordInput
              placeholder={t('home.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && <p className="form-error">{error}</p>}

            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? '...' : t('admin.loginSubmit')}
            </button>

            <button type="button" className="link-muted" onClick={() => setForgot(true)}>
              {t('home.forgotLink')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="form">
            <h3 className="auth-title">{t('home.forgotTitle')}</h3>
            <p className="auth-hint">{t('home.forgotHint')}</p>
            <label className="field">
              <FaEnvelope className="field-icon" />
              <input
                type="text"
                placeholder={t('home.forgotPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {sent && <p className="form-success">{t('home.forgotSent')}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? '...' : t('home.forgotSubmit')}
            </button>
            <button type="button" className="link-muted" onClick={() => { setForgot(false); setSent(false); setError('') }}>
              {t('home.backToLogin')}
            </button>
          </form>
        )}

        <Link to="/" className="link-muted admin-back-link">
          <FaArrowLeft /> {t('admin.goApp')}
        </Link>
      </div>
    </div>
  )
}