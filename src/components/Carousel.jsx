import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaChalkboardUser, FaCalendarCheck, FaGear } from 'react-icons/fa6'
import { useLang } from '../i18n'
import iconUrl from '../assets/icon-192.png'

const slides = [
  {
    tipo: 'course',
    icon: FaChalkboardUser,
    grad: 'grad-purple',
    img: iconUrl,
    sectionTitle: 'cat.course.title',
    subtitle: 'cat.course.subtitle'
  },
  {
    tipo: 'workshop',
    icon: FaGear,
    grad: 'grad-gold',
    img: iconUrl,
    sectionTitle: 'cat.workshop.title',
    subtitle: 'cat.workshop.subtitle'
  },
  {
    tipo: 'event',
    icon: FaCalendarCheck,
    grad: 'grad-red',
    img: iconUrl,
    sectionTitle: 'cat.event.title',
    subtitle: 'cat.events.subtitle'
  }
]

export default function Carousel() {
  const { t } = useLang()
  const trackRef = useRef(null)
  const [current, setCurrent] = useState(0)

  const scrollTo = (index) => {
    const track = trackRef.current
    if (!track) return
    const cards = track.children
    if (!cards[index]) return
    track.scrollTo({ left: cards[index].offsetLeft - track.offsetLeft, behavior: 'smooth' })
  }

  const onScroll = (e) => {
    const track = e.currentTarget
    const cards = track.children
    if (!cards.length) return
    const center = track.scrollLeft + track.clientWidth / 2
    let closest = 0
    let diff = Infinity
    for (let i = 0; i < cards.length; i += 1) {
      const c = cards[i].offsetLeft - track.offsetLeft + cards[i].clientWidth / 2
      const d = Math.abs(c - center)
      if (d < diff) {
        diff = d
        closest = i
      }
    }
    setCurrent(closest)
  }

  return (
    <section className="carousel" aria-label="Sections">
      <div className="carousel-head">
        <h3 className="section-title">{t('home.explore')}</h3>
        <p className="section-hint">{t('home.exploreHint')}</p>
      </div>

      <div className="carousel-viewport">
        <button
          className="carousel-arrow carousel-arrow-left"
          aria-label="Anterior"
          onClick={() => scrollTo(Math.max(0, current - 1))}
        >
          <FaChevronLeft />
        </button>

        <div className="carousel-track" ref={trackRef} onScroll={onScroll}>
          {slides.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.tipo} to={`/catalog/${s.tipo}`} className={`carousel-slide ${s.grad}`}>
                <div className="carousel-card-inner">
                  <div className="carousel-icon">
                    <Icon />
                  </div>
                  <img src={s.img} alt="" className="carousel-thumb" loading="lazy" />
                  <div className="carousel-body">
                    <h4>{t(s.sectionTitle)}</h4>
                    <p>{t(s.subtitle)}</p>
                    <span className="carousel-link">Ver todo →</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <button
          className="carousel-arrow carousel-arrow-right"
          aria-label="Siguiente"
          onClick={() => scrollTo(Math.min(slides.length - 1, current + 1))}
        >
          <FaChevronRight />
        </button>
      </div>

      <div className="carousel-dots">
        {slides.map((s, i) => (
          <button
            key={s.tipo}
            className={`dot ${i === current ? 'is-active' : ''}`}
            aria-label={`Ir a ${i + 1}`}
            onClick={() => {
              setCurrent(i)
              scrollTo(i)
            }}
          />
        ))}
      </div>
    </section>
  )
}