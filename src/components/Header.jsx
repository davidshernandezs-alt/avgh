import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  FaLinkedinIn,
  FaInstagram,
  FaFacebookF,
  FaXTwitter,
  FaYoutube,
  FaWhatsapp
} from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { SOCIAL } from '../config'
import logoUrl from '../assets/avgh_logo.png'

const socialIcons = [
  { name: 'linkedin', Icon: FaLinkedinIn },
  { name: 'instagram', Icon: FaInstagram },
  { name: 'facebook', Icon: FaFacebookF },
  { name: 'x', Icon: FaXTwitter },
  { name: 'youtube', Icon: FaYoutube },
  { name: 'whatsapp', Icon: FaWhatsapp }
]

function languageLabel(lang) {
  return lang === 'es' ? 'ES' : 'EN'
}

export default function Header() {
  const { lang, setLang, t } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header-top">
        <Link to="/" className="header-logo" aria-label="AVGH">
          <img src={logoUrl} alt="AVGH" />
        </Link>

        <div className="header-actions">
          <button
            className="lang-toggle"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            aria-label="Cambiar idioma"
          >
            {languageLabel(lang)}
          </button>
          <div className="social-icons">
            {socialIcons.map(({ name, Icon }) => {
              const url = SOCIAL[name]
              const isWa = name === 'whatsapp'
              return (
                <a
                  key={name}
                  href={url || undefined}
                  target={url ? (isWa ? undefined : '_blank') : undefined}
                  rel="noopener noreferrer"
                  className={`social-icon social-${name}${url ? '' : ' is-disabled'}`}
                  aria-label={name}
                  title={name}
                  onClick={!url ? (e) => e.preventDefault() : undefined}
                >
                  <Icon />
                </a>
              )
            })}
          </div>
        </div>
      </div>

      <nav className="header-nav">
        <NavLink to="/" end>
          {t('nav.home')}
        </NavLink>
        <NavLink to="/catalog/course">{t('nav.courses')}</NavLink>
        <NavLink to="/catalog/workshop">{t('nav.workshops')}</NavLink>
        <NavLink to="/catalog/event">{t('nav.events')}</NavLink>
        {user ? (
          <>
            <NavLink to="/perfil">{t('nav.profile')}</NavLink>
            <button className="nav-link-btn" onClick={handleLogout}>
              {t('nav.signOut')}
            </button>
          </>
        ) : (
          <NavLink to="/" end className="nav-signin">
            {t('nav.signIn')}
          </NavLink>
        )}
      </nav>
    </header>
  )
}