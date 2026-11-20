import { useParams, Link } from 'react-router-dom'
import { FaArrowLeft, FaTriangleExclamation } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useActivities } from '../data/useData'
import ActivityCard from '../components/ActivityCard'

export default function Catalog() {
  const { tipo } = useParams()
  const { t } = useLang()
  const { items, loading, error } = useActivities(tipo)

  const meta = {
    course: { title: t('cat.course.title'), subtitle: t('cat.course.subtitle') },
    workshop: { title: t('cat.workshop.title'), subtitle: t('cat.workshop.subtitle') },
    event: { title: t('cat.event.title'), subtitle: t('cat.events.subtitle') }
  }[tipo] || { title: t('type.courses'), subtitle: '' }

  return (
    <div className="page">
      <div className="page-head">
        <Link to="/" className="btn-icon" aria-label="Volver">
          <FaArrowLeft />
        </Link>
        <div className="page-head-text">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading">{t('cat.loading')}</div>
      ) : error ? (
        <div className="empty empty-error">
          <FaTriangleExclamation />
          <p>{t('cat.error')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">{t('cat.empty')}</div>
      ) : (
        <div className="grid-cards">
          {items.map((item) => (
            <ActivityCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}