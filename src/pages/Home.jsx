import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaArrowRight, FaEnvelope, FaUser, FaPhone, FaCircleCheck, FaUserShield, FaIdCard } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from '../components/PasswordInput'
import Carousel from '../components/Carousel'
import NewsFeed from '../components/NewsFeed'
import { SITE_NAME } from '../config'
import logoUrl from '../assets/avgh_logo.png'

const errorMap = {
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/invalid-email': 'auth.invalidEmail',
  'auth/weak-password': 'auth.weakPassword',
  'auth/network-request-failed': 'auth.noNetwork',
  'auth/too-many-requests': 'auth.tooManyRequests',
  'auth/user-not-found': 'auth.userNotFound',
  'auth/wrong-password': 'auth.wrongPassword'
}

function codeOf(err) {
  return (err && (err.code || err.message)) || ''
}

function authMessage(err, t) {
  const c = codeOf(err)
  return errorMap[c] ? t(errorMap[c]) : ''
}

function AuthSection() {
  const { t } = useLang()
  const { login, register, sendReset, user, profile } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({
    tipoPersona: 'natural',
    nombres: '',
    apellidos: '',
    telefono: '',
    email: '',
    password: '',
    confirm: '',
    dni: '',
    rif: '',
    cedula: '',
    nombreEmpresa: '',
    telefonoCelular: '',
    telefonoEmpresa: '',
    cargo: '',
    direccionFiscal: '',
    direccionOficina: '',
    contactoFacturaNombre: '',
    contactoFacturaEmail: '',
    responsableNombre: '',
    responsableTelefono: '',
    comoSeEntero: ''
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    if (user && profile?.rol === 'admin') {
      navigate('/admin/panel', { replace: true })
    }
  }, [user, profile, navigate])

  const requiredJuridico = [
    'rif',
    'nombreEmpresa',
    'nombres',
    'apellidos',
    'telefonoCelular',
    'email'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'login') {
      setBusy(true)
      try {
        await login(form.dni, form.password)
      } catch (err) {
        setError(
          codeOf(err) === 'auth-unavailable'
            ? t('home.authUnavailable')
            : !form.dni.includes('@')
              ? 'No se encontró esa cédula o la clave no coincide. Si te registraron recientemente, usa tu cédula (sin puntos) como clave. Si ya la cambiaste, ingresa con tu correo.'
              : authMessage(err, t) || t('home.loginError')
        )
      } finally {
        setBusy(false)
      }
    } else {
      if (form.password !== form.confirm) {
        setError(t('home.errorPasswordMismatch'))
        return
      }
      const body = { dni: form.dni, email: form.email, password: form.password, tipoPersona: form.tipoPersona }
      if (form.tipoPersona === 'juridico') {
        Object.assign(body, {
          rif: form.rif,
          cedula: form.cedula,
          nombreEmpresa: form.nombreEmpresa,
          nombres: form.nombres,
          apellidos: form.apellidos,
          telefonoCelular: form.telefonoCelular,
          telefonoEmpresa: form.telefonoEmpresa,
          cargo: form.cargo,
          direccionFiscal: form.direccionFiscal,
          direccionOficina: form.direccionOficina,
          contactoFacturaNombre: form.contactoFacturaNombre,
          contactoFacturaEmail: form.contactoFacturaEmail,
          responsableNombre: form.responsableNombre,
          responsableTelefono: form.responsableTelefono,
          comoSeEntero: form.comoSeEntero
        })
        const missing = requiredJuridico.some((k) => !form[k])
        if (missing) {
          setError(t('home.requiredField'))
          return
        }
      } else {
        body.nombres = form.nombres
        body.apellidos = form.apellidos
        body.telefono = form.telefono
        body.dni = form.dni
        if (!form.dni || !form.nombres || !form.apellidos || !form.password) {
          setError(t('home.requiredField'))
          return
        }
      }
      setBusy(true)
      try {
        await register(body)
      } catch (err) {
        setError(
          codeOf(err) === 'auth-unavailable'
            ? t('home.authUnavailable')
            : authMessage(err, t) || t('home.registerError')
        )
      } finally {
        setBusy(false)
      }
    }
  }

  const handleSetupPass = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.dni || !form.password) {
      setError(t('home.requiredField'))
      return
    }
    if (form.password !== form.confirm) {
      setError(t('home.errorPasswordMismatch'))
      return
    }
    setBusy(true)
    try {
      await login(form.dni, form.password)
    } catch (err) {
      setError(authMessage(err, t) || 'No se encontró la cédula o no se pudo crear la clave.')
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setSent(false)
    if (!form.email) {
      setError(t('home.requiredField'))
      return
    }
    setBusy(true)
    try {
      await sendReset(form.email)
      setSent(true)
    } catch (err) {
      const c = String(codeOf(err) || '')
      if (c === 'auth-unavailable') setError(t('home.authUnavailable'))
      else if (c.includes('network')) setError(t('auth.noNetwork'))
      else if (c.includes('no-email')) setError(t('home.forgotNoEmail'))
      else if (c.includes('not-found') || c.includes('invalid-email')) setError(t('home.forgotNotFound'))
      else setSent(true)
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    const fullName = profile
      ? `${profile.nombres || ''} ${profile.apellidos || ''}`.trim()
      : ''
    return (
      <div className="auth-card welcome-card">
        <div className="welcome-icon">
          <FaCircleCheck />
        </div>
        <h3>{t('home.welcome')} {fullName}</h3>
        <p>{t('home.welcomeHint')}</p>
        <Link to="/perfil" className="btn btn-primary btn-block">
          {t('home.goToProfile')} <FaArrowRight />
        </Link>
        <Link to="/catalog/course" className="link-muted">
          {t('home.explore')}
        </Link>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button
          className={`auth-tab ${mode === 'login' ? 'is-active' : ''}`}
          onClick={() => {
            setMode('login')
            setError('')
          }}
        >
          {t('nav.signIn')}
        </button>
        <button
          className={`auth-tab ${mode === 'register' ? 'is-active' : ''}`}
          onClick={() => {
            setMode('register')
            setError('')
          }}
        >
          {t('home.registerTitle')}
        </button>
      </div>

      {mode === 'login' ? (
        <div className="auth-panel">
          <h3 className="auth-title">{t('home.loginTitle')}</h3>
          <p className="auth-hint">{t('home.loginHint')}</p>
          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              <FaUser className="field-icon" />
              <input
                type="text"
                placeholder={t('home.emailPlaceholder')}
                value={form.dni}
                onChange={set('dni')}
                autoComplete="username"
                required
              />
            </label>
            <PasswordInput
              placeholder={t('home.password')}
              value={form.password}
              onChange={set('password')}
              autoComplete="current-password"
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? '...' : t('home.loginSubmit')}
            </button>
          </form>
          <button className="link-muted" onClick={() => { setMode('setupPass'); setError('') }}>
            🔑 ¿Inscrito en un curso? Crea o configura tu clave
          </button>
          <button className="link-muted" onClick={() => setMode('register')}>
            {t('home.switchToRegister')}
          </button>
          <button className="link-muted" onClick={() => { setMode('forgot'); setError('') }}>
            {t('home.forgotLink')}
          </button>
          <Link to="/admin" className="admin-access-link">
            <FaUserShield /> {t('home.adminAccess')}
          </Link>
        </div>
      ) : mode === 'setupPass' ? (
        <div className="auth-panel">
          <h3 className="auth-title">Crear Contraseña para Inscritos</h3>
          <p className="auth-hint">Si ya estás inscrito en un evento o curso, ingresa tu cédula y define tu clave para acceder a tu perfil y ver tu carnet QR.</p>
          <form onSubmit={handleSetupPass} className="form">
            <label className="field">
              <FaUser className="field-icon" />
              <input
                type="text"
                placeholder={t('profile.dni')}
                value={form.dni}
                onChange={set('dni')}
                required
              />
            </label>
            <PasswordInput
              placeholder="Nueva Contraseña"
              value={form.password}
              onChange={set('password')}
              required
            />
            <small className="auth-hint" style={{ fontSize: '11px', marginTop: '-6px', marginBottom: '8px', display: 'block' }}>
              ℹ️ Mínimo 6 caracteres (letras, números o símbolos).
            </small>
            <PasswordInput
              placeholder="Confirmar Nueva Contraseña"
              value={form.confirm}
              onChange={set('confirm')}
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? '...' : 'Crear Contraseña e Iniciar Sesión'}
            </button>
            <button type="button" className="link-muted" onClick={() => { setMode('login'); setError('') }}>
              {t('home.backToLogin')}
            </button>
          </form>
        </div>
      ) : mode === 'forgot' ? (
        <div className="auth-panel">
          <h3 className="auth-title">{t('home.forgotTitle')}</h3>
          <p className="auth-hint">{t('home.forgotHint')}</p>
          <form onSubmit={handleForgot} className="form">
            <label className="field">
              <FaEnvelope className="field-icon" />
              <input type="text" placeholder={t('home.forgotPlaceholder')} value={form.email} onChange={set('email')} autoComplete="email" required />
            </label>
            {error && <p className="form-error">{error}</p>}
            {sent && <p className="form-success">{t('home.forgotSent')}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? '...' : t('home.forgotSubmit')}
            </button>
          </form>
          <button className="link-muted" onClick={() => { setMode('login'); setError(''); setSent(false) }}>
            {t('home.backToLogin')}
          </button>
        </div>
      ) : (
        <div className="auth-panel">
          <h3 className="auth-title">{t('home.registerTitle')}</h3>
          <p className="auth-hint">{t('home.registerHint')}</p>

          <form onSubmit={handleSubmit} className="form">
            <div className="field-label">
            <span>{t('home.tipoPersona')}</span>
            <div className="radio-group">
              <label className={`radio-card ${form.tipoPersona === 'natural' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="tipoPersona"
                  value="natural"
                  checked={form.tipoPersona === 'natural'}
                  onChange={() => setForm((f) => ({ ...f, tipoPersona: 'natural' }))}
                />
                <span>{t('home.tipoNatural')}</span>
              </label>
              <label className={`radio-card ${form.tipoPersona === 'juridico' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="tipoPersona"
                  value="juridico"
                  checked={form.tipoPersona === 'juridico'}
                  onChange={() => setForm((f) => ({ ...f, tipoPersona: 'juridico' }))}
                />
                <span>{t('home.tipoJuridico')}</span>
              </label>
            </div>
          </div>

          {form.tipoPersona === 'natural' ? (
            <>
              <div className="field-row">
                <label className="field">
                  <FaUser className="field-icon" />
                  <input placeholder={t('home.firstName')} value={form.nombres} onChange={set('nombres')} required />
                </label>
                <label className="field">
                  <FaUser className="field-icon" />
                  <input placeholder={t('home.lastName')} value={form.apellidos} onChange={set('apellidos')} required />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <FaUser className="field-icon" />
                  <input placeholder={t('home.cedula')} value={form.dni} onChange={set('dni')} required />
                </label>
                <label className="field">
                  <FaPhone className="field-icon" />
                  <input type="tel" placeholder={t('home.phone')} value={form.telefono} onChange={set('telefono')} />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="auth-section-label">{t('home.companyData')}</p>
              <div className="field-row">
                <label className="field">
                  <input placeholder={t('home.rif')} value={form.rif} onChange={set('rif')} required />
                </label>
                <label className="field">
                  <input placeholder={t('home.cedula')} value={form.cedula} onChange={set('cedula')} />
                </label>
              </div>
              <label className="field">
                <input placeholder={t('home.nombreEmpresa')} value={form.nombreEmpresa} onChange={set('nombreEmpresa')} required />
              </label>
              <div className="field-row">
                <label className="field">
                  <input placeholder={t('home.firstName')} value={form.nombres} onChange={set('nombres')} required />
                </label>
                <label className="field">
                  <input placeholder={t('home.lastName')} value={form.apellidos} onChange={set('apellidos')} required />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <FaPhone className="field-icon" />
                  <input type="tel" placeholder={t('home.telefonoCelular')} value={form.telefonoCelular} onChange={set('telefonoCelular')} required />
                </label>
                <label className="field">
                  <FaPhone className="field-icon" />
                  <input type="tel" placeholder={t('home.telefonoEmpresa')} value={form.telefonoEmpresa} onChange={set('telefonoEmpresa')} />
                </label>
              </div>
              <label className="field">
                <input type="text" placeholder={t('home.cargo')} value={form.cargo} onChange={set('cargo')} />
              </label>
              <label className="field">
                <input type="text" placeholder={t('home.direccionFiscal')} value={form.direccionFiscal} onChange={set('direccionFiscal')} />
              </label>
              <label className="field">
                <input type="text" placeholder={t('home.direccionOficina')} value={form.direccionOficina} onChange={set('direccionOficina')} />
              </label>
              <div className="field-row">
                <label className="field">
                  <input type="text" placeholder={t('home.contactoFacturaNombre')} value={form.contactoFacturaNombre} onChange={set('contactoFacturaNombre')} />
                </label>
                <label className="field">
                  <input type="email" placeholder={t('home.contactoFacturaEmail')} value={form.contactoFacturaEmail} onChange={set('contactoFacturaEmail')} />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <input type="text" placeholder={t('home.responsableNombre')} value={form.responsableNombre} onChange={set('responsableNombre')} />
                </label>
                <label className="field">
                  <FaPhone className="field-icon" />
                  <input type="tel" placeholder={t('home.telefonoCelular')} value={form.responsableTelefono} onChange={set('responsableTelefono')} />
                </label>
              </div>
            </>
          )}

          <label className="field">
            <FaEnvelope className="field-icon" />
            <input type="email" placeholder={t('home.email')} value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>

          {form.tipoPersona === 'juridico' && (
            <label className="field field-select">
              <select value={form.comoSeEntero} onChange={set('comoSeEntero')} className="input">
                <option value="">{t('home.comoSeEntero')}…</option>
                {['promocion', 'correo', 'redes', 'internet', 'referidos', 'otro'].map((o) => (
                  <option key={o} value={o}>{t(`home.comoSeEntero.${o}`)}</option>
                ))}
              </select>
            </label>
          )}

            <PasswordInput
              placeholder={t('home.password')}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              required
            />
            <small className="auth-hint" style={{ fontSize: '11px', marginTop: '-6px', marginBottom: '8px', display: 'block' }}>
              ℹ️ Mínimo 6 caracteres (letras, números o símbolos).
            </small>
            <PasswordInput
              placeholder={t('home.confirmPassword')}
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              required
            />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? '...' : t('home.registerSubmit')}
          </button>
          </form>
          <button className="link-muted" onClick={() => setMode('login')}>
            {t('home.switchToLogin')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { t } = useLang()
  const { user, profile } = useAuth()

  const scrollToAuth = () => {
    document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="home">
      <section className="hero">
        <img src={logoUrl} alt={SITE_NAME} className="hero-logo" />
        {profile?.afiliado && (
          <p className="hero-user">
            {t('home.welcome')} {profile.nombres}
          </p>
        )}
        <p className="hero-subtitle">{t('home.heroSubtitle')}</p>
      </section>

      <section className="auth-wrap" id="auth">
        <AuthSection />
      </section>

      {!user && (
        <div className="hero-cta-wrap">
          <button className="btn btn-outline btn-block" onClick={scrollToAuth}>
            {t('home.heroCta')} <FaArrowRight />
          </button>
        </div>
      )}

      <section className="aff-cta-card">
        <span className="aff-cta-icon">
          <FaIdCard />
        </span>
        <div className="aff-cta-text">
          <h2>{t('home.affiliateTitle')}</h2>
          <p>{t('home.affiliateDesc')}</p>
        </div>
        <Link to="/afiliacion" className="btn btn-gold">
          {profile?.afiliado ? t('home.affiliateCtaMember') : t('home.affiliateCta')} <FaArrowRight />
        </Link>
      </section>

      <Carousel />

      <NewsFeed />
    </div>
  )
}