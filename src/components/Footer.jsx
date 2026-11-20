import { Link } from 'react-router-dom'
import { FaLinkedinIn, FaInstagram, FaFacebookF, FaXTwitter, FaYoutube, FaWhatsapp } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { SOCIAL, CONTACT, SITE_NAME } from '../config'
import logoUrl from '../assets/avgh_logo.png'

const socialIcons = [
  { name: 'linkedin', Icon: FaLinkedinIn },
  { name: 'instagram', Icon: FaInstagram },
  { name: 'facebook', Icon: FaFacebookF },
  { name: 'x', Icon: FaXTwitter },
  { name: 'youtube', Icon: FaYoutube },
  { name: 'whatsapp', Icon: FaWhatsapp }
]

export default function Footer() {
  const { t } = useLang()

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <a href="https://avgh.org.ve/" target="_blank" rel="noopener noreferrer" className="footer-logo-link" title={SITE_NAME}>
            <img src={logoUrl} alt={SITE_NAME} className="footer-logo" />
          </a>
          <p>{t('footer.tagline')}</p>
        </div>

        <div>
          <h4>{t('footer.quickLinks')}</h4>
          <ul className="footer-links">
            <li>
              <Link to="/catalog/course">{t('nav.courses')}</Link>
            </li>
            <li>
              <Link to="/catalog/workshop">{t('nav.workshops')}</Link>
            </li>
            <li>
              <Link to="/catalog/event">{t('nav.events')}</Link>
            </li>
            <li>
              <Link to="/perfil">{t('nav.profile')}</Link>
            </li>
          </ul>
        </div>

        <div>
          <h4>{t('footer.followUs')}</h4>
          <div className="social-icons social-icons-row">
            {socialIcons.map(({ name, Icon }) => {
              const url = SOCIAL[name]
              const isWa = name === 'whatsapp'
              return (
                <a
                  key={name}
                  href={url || undefined}
                  target={url ? (isWa ? undefined : '_blank') : undefined}
                  rel="noopener noreferrer"
                  className={`social-icon social-${name}`}
                  aria-label={name}
                  title={name}
                  onClick={!url ? (e) => e.preventDefault() : undefined}
                >
                  <Icon />
                </a>
              )
            })}
          </div>
          {CONTACT.email && <p className="footer-contact">{CONTACT.email}</p>}
          {CONTACT.phone && <p className="footer-contact">{CONTACT.phone}</p>}
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} {SITE_NAME} · {t('footer.rights')}
        </p>
        <p className="footer-credit">
          Desarrollado por Dsamuelhs · <Link to="/admin" className="footer-admin-link">{t('footer.admin')}</Link>
        </p>
      </div>
    </footer>
  )
}