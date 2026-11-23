import { Link, useParams, useNavigate } from 'react-router-dom'
import { FaArrowLeft, FaCalendarDay, FaClock, FaUserGraduate, FaUsers, FaSackDollar, FaBullseye, FaListUl, FaChalkboardUser, FaUserCheck, FaLocationDot } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { useActivity, useAffiliationConfig, useMyInscriptions } from '../data/useData'
import { calcularPrecioInscripcion, tipoAsistenteEn } from '../data/pricing'
import { formatDate } from '../components/ActivityCard'
import { localize } from '../utils/localized'
import { CURRENCY } from '../config'

export default function ActivityDetail() {
  const { tipo, id } = useParams()
  const { lang, t } = useLang()
  const { user, profile } = useAuth()
  const { item, loading } = useActivity(id)
  const { config: affConfig } = useAffiliationConfig()
  const { items: misInscripciones } = useMyInscriptions(user?.uid)
  const pricing = calcularPrecioInscripcion({
    precio: item?.precio,
    profile,
    config: affConfig,
    actividad: item,
    tipoAsistente: tipoAsistenteEn(misInscripciones, id)
  })
  const navigate = useNavigate()

  if (loading) return <div className="page"><div className="loading">{t('cat.loading')}</div></div>

  if (!item) {
    return (
      <div className="page">
        <div className="empty">
          <p>{t('cat.empty')}</p>
          <Link to="/" className="btn btn-primary">
            {t('insc.goHome')}
          </Link>
        </div>
      </div>
    )
  }

  const title =
    item.titulo && typeof item.titulo === 'object'
      ? (item.titulo[lang] || item.titulo.es || '')
      : item.titulo
  const desc = localize(item.descripcion, lang)
  const objetivo = localize(item.objetivoGeneral, lang)
  const contenido = localize(item.contenido, lang)
  const modalidad =
    item.modalidad && typeof item.modalidad === 'object'
      ? t(`detail.modality.${item.modalidad[lang] || item.modalidad.es}`) || item.modalidad[lang]
      : item.modalidad
        ? t(`detail.modality.${item.modalidad}`)
        : ''

  return (
    <div className="page">
      <div className="page-head">
        <Link to={`/catalog/${tipo}`} className="btn-icon" aria-label="Volver">
          <FaArrowLeft />
        </Link>
        <div className="page-head-text">
          <h1>{title}</h1>
          <span className="activity-badge">{t(`type.${item.tipo}`)}</span>
        </div>
      </div>

      <article className="detail-card">
        <div className={`detail-cover cover-${item.tipo}`}>
        {item.imagenBanner || item.imagen ? (
          <img src={item.imagenBanner || item.imagen} alt={title} className="detail-cover-img" loading="lazy" />
        ) : (
          <span className="detail-cover-letter">{title ? title.charAt(0) : '?'}</span>
        )}
      </div>

      <div className="detail-enroll-top">
        {user ? (
          <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate(`/inscribirse/${tipo}/${id}`)}>
            {t('detail.inscribirse')}
          </button>
        ) : (
          <div className="detail-login-msg">
            <p>{t('detail.requireLogin')}</p>
            <Link to="/" className="btn btn-primary btn-block">
              {t('detail.loginNow')}
            </Link>
          </div>
        )}
      </div>

      <div className="detail-body">
          <p className="detail-desc">{desc}</p>

          <h3 className="detail-section-title">{t('detail.getInfo')}</h3>
          <ul className="detail-list">
            {item.fechaInicio && (
              <li>
                <FaCalendarDay /> <strong>{t('detail.startDate')}:</strong>{' '}
                {formatDate(item.fechaInicio, lang)}
              </li>
            )}
            {item.fechaFin && (
              <li>
                <FaCalendarDay /> <strong>{t('detail.endDate')}:</strong>{' '}
                {formatDate(item.fechaFin, lang)}
              </li>
            )}
            {item.horario && (
              <li>
                <FaClock /> <strong>{t('detail.schedule')}:</strong> {item.horario}
              </li>
            )}
            {localize(item.lugar, lang) && (
              <li>
                <FaLocationDot /> <strong>{t('detail.place')}:</strong> {localize(item.lugar, lang)}
              </li>
            )}
            {item.duracion && (
              <li>
                <FaClock /> <strong>{t('detail.duration')}:</strong> {item.duracion}
              </li>
            )}
            {modalidad && (
              <li>
                <FaUserGraduate /> <strong>{t('detail.modality')}:</strong> {modalidad}
              </li>
            )}
            {item.instructor && (
              <li>
                <FaUserGraduate /> <strong>{t('detail.instructor')}:</strong> {item.instructor}
              </li>
            )}
            {item.cupo && (
              <li>
                <FaUsers /> <strong>{t('detail.cupo')}:</strong> {item.cupo}
              </li>
            )}
            <li>
              <FaSackDollar /> <strong>{t('detail.price')}:</strong>{' '}
              {(item.precio ?? 0) > 0 ? `${CURRENCY}${item.precio} + IVA` : t('detail.free')}
            </li>
            {pricing.gratisAfiliados && (item.precio ?? 0) > 0 && (
              <li className="detail-affiliate-price">
                <FaUserCheck /> <strong>{t('insc.affiliatePrice')}:</strong> {t('detail.free')}
              </li>
            )}
            {!pricing.gratisAfiliados && pricing.descuentoPorcentaje > 0 && (item.precio ?? 0) > 0 && (
              <li className="detail-affiliate-price">
                <FaUserCheck /> <strong>{t('insc.affiliatePrice')}:</strong> {CURRENCY}{pricing.montoUnitario} · {t('insc.youSave')} {pricing.descuentoPorcentaje}%
              </li>
            )}
          </ul>

          {objetivo && (
            <div className="detail-block">
              <h4 className="detail-block-title">
                <FaBullseye /> {t('detail.objective')}
              </h4>
              <p>{objetivo}</p>
            </div>
          )}

          {contenido && (
            <div className="detail-block">
              <h4 className="detail-block-title">
                <FaListUl /> {t('detail.content')}
              </h4>
              <ul className="detail-content-list">
                {contenido
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
              </ul>
            </div>
          )}

          {(item.facilitadores || item.instructor) && (
            <div className="detail-block">
              <h4 className="detail-block-title">
                <FaChalkboardUser /> {t('detail.facilitators')}
              </h4>
              <ul className="detail-content-list">
                {(Array.isArray(item.facilitadores)
                  ? item.facilitadores
                  : String(item.facilitadores || '')
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean)
                ).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
                {item.instructor && (
                  <li>{item.instructor}</li>
                )}
              </ul>
            </div>
          )}

        </div>
      </article>
    </div>
  )
}