import { Link } from 'react-router-dom'
import { FaCalendarDay, FaClock } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { CURRENCY } from '../config'

export function formatDate(ts, lang) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export default function ActivityCard({ item }) {
  const { lang, t } = useLang()
  const title = item.titulo && typeof item.titulo === 'object' ? item.titulo[lang] : item.titulo
  const desc =
    item.descripcion && typeof item.descripcion === 'object'
      ? item.descripcion[lang]
      : item.descripcion

  return (
    <Link to={`/actividad/${item.tipo}/${item.id}`} className="activity-card">
      <div className={`activity-cover cover-${item.tipo}`}>
        <span className="activity-badge">{t(`type.${item.tipo}`)}</span>
        {item.imagen ? (
          <img src={item.imagen} alt={title} className="activity-cover-img" loading="lazy" />
        ) : (
          <span className="activity-cover-letter">{title ? title.charAt(0) : '?'}</span>
        )}
      </div>
      <div className="activity-body">
        <h3>{title}</h3>
        <p className="activity-desc">{String(desc || '').slice(0, 110)}</p>
        <div className="activity-meta">
          {item.fechaInicio && (
            <span>
              <FaCalendarDay /> {formatDate(item.fechaInicio, lang)}
            </span>
          )}
          {item.duracion && (
            <span>
              <FaClock /> {item.duracion}
            </span>
          )}
        </div>
        <div className="activity-footer">
          <span className="activity-price">
            {(item.precio ?? 0) > 0 ? `${CURRENCY}${item.precio}` : t('detail.free')}
          </span>
          <span className="activity-cta">→</span>
        </div>
      </div>
    </Link>
  )
}