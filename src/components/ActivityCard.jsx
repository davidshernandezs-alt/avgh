import { Link } from 'react-router-dom'
import { useState } from 'react'
import { FaCalendarDay, FaClock, FaLocationDot, FaArrowRight, FaShare } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { CURRENCY } from '../config'
import { useAuth } from '../auth/AuthContext'
import { useAffiliationConfig, useMyInscriptions } from '../data/useData'
import { calcularPrecioInscripcion, tipoAsistenteEn } from '../data/pricing'

export function formatDate(ts, lang) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function localized(value, lang) {
  if (value && typeof value === 'object') return value[lang] || value.es || ''
  return value || ''
}

export default function ActivityCard({ item }) {
  const { lang, t } = useLang()
  const { user, profile } = useAuth()
  const { config: affConfig } = useAffiliationConfig()
  const { items: misInscripciones } = useMyInscriptions(user?.uid)
  const pricing = calcularPrecioInscripcion({
    precio: item?.precio,
    profile,
    config: affConfig,
    actividad: item,
    tipoAsistente: tipoAsistenteEn(misInscripciones, item?.id) ||
      (profile?.perfilAsistente === 'junta' ? 'junta'
        : profile?.perfilAsistente === 'facilitador' ? 'facilitador' : '')
  })
  const title = localized(item.titulo, lang)
  const desc = localized(item.descripcion, lang)
  const lugar = localized(item.lugar, lang) || item.ubicacion || item.lugar || ''
  const [shared, setShared] = useState(false)

  const shareEvent = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/#/actividad/${item.tipo}/${item.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title, text: desc || title, url })
        return
      } catch {
        /* cancelado: copiar */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2500)
    } catch {
      window.prompt('Copia este enlace:', url)
    }
  }

  return (
    <article className="activity-card">
      <Link to={`/actividad/${item.tipo}/${item.id}`} className={`activity-cover cover-${item.tipo}`}>
        <span className="activity-badge">{t(`type.${item.tipo}`)}</span>
        {item.imagen ? (
          <img src={item.imagen} alt={title} className="activity-cover-img" loading="lazy" />
        ) : (
          <span className="activity-cover-letter">{title ? title.charAt(0) : '?'}</span>
        )}
      </Link>
      <div className="activity-body">
        <h3>{title}</h3>

        <div className="activity-meta">
          {item.fechaInicio && (
            <span><FaCalendarDay /> {formatDate(item.fechaInicio, lang)}</span>
          )}
          {item.horario && (
            <span><FaClock /> {item.horario}</span>
          )}
          {!item.horario && item.duracion && (
            <span><FaClock /> {item.duracion}</span>
          )}
          {lugar && (
            <span><FaLocationDot /> {String(lugar)}</span>
          )}
        </div>

        <p className="activity-desc">{String(desc || '').slice(0, 140)}</p>

        <div className="activity-footer">
          <span className="activity-price">
            {(item.precio ?? 0) > 0 ? `${CURRENCY}${item.precio} + IVA` : t('detail.free')}
          </span>
          {pricing.gratisAfiliados && (item.precio ?? 0) > 0 && (
            <span className="activity-affiliate-price">
              {t('insc.affiliatePrice')}: {t('detail.free')}
            </span>
          )}
          {!pricing.gratisAfiliados && pricing.descuentoPorcentaje > 0 && (item.precio ?? 0) > 0 && (
            <span className="activity-affiliate-price">
              {t('insc.affiliatePrice')}: {CURRENCY}{pricing.montoUnitario} · {t('insc.youSave')} {pricing.descuentoPorcentaje}%
            </span>
          )}
        </div>

        <div className="activity-card-actions">
          <Link to={`/actividad/${item.tipo}/${item.id}`} className="btn btn-outline activity-readmore">
            {t('card.readMore')} <FaArrowRight />
          </Link>
          <button
            type="button"
            className="btn btn-outline btn-share-card"
            onClick={shareEvent}
            title={t('detail.share')}
            aria-label={t('detail.share')}
          >
            <FaShare /> {shared ? '✓' : ''}
          </button>
        </div>
      </div>
    </article>
  )
}
