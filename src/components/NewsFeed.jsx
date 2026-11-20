import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaHeart, FaComment, FaShareNodes, FaNewspaper } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { usePosts, togglePostLike, addPostComment } from '../data/useData'
import { formatDate } from '../components/ActivityCard'
import { postHtml } from '../utils/html'
import { SITE_NAME } from '../config'
import logoUrl from '../assets/avgh_logo.png'

function ini(nombre) {
  if (!nombre) return '?'
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
}

export default function NewsFeed() {
  const { t, lang } = useLang()
  const { user, profile } = useAuth()
  const { items, loading, error } = usePosts()
  const [openComment, setOpenComment] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [sent, setSent] = useState(null)

  const me = `${profile?.nombres || ''} ${profile?.apellidos || ''}`.trim() || profile?.email || user?.email || ''

  const like = async (p) => {
    if (!user) return
    try {
      await togglePostLike(p.id, user.uid)
    } catch {
      /* silencioso */
    }
  }

  const comment = async (p, e) => {
    e.preventDefault()
    const txt = commentText.trim()
    if (!user || !txt) return
    try {
      await addPostComment(p.id, { uid: user.uid, nombre: me, texto: txt })
      setCommentText('')
      setSent(p.id)
    } catch {
      /* silencioso */
    }
  }

  const share = async (p) => {
    const texto = `${p.texto || SITE_NAME} — ${SITE_NAME}`
    const url = window.location.href.split('#')[0]
    try {
      if (navigator.share) {
        await navigator.share({ title: SITE_NAME, text: texto, url })
      } else {
        await navigator.clipboard.writeText(url)
        window.alert(t('news.shared'))
      }
    } catch {
      /* el usuario canceló */
    }
  }

  if (loading) {
    return (
      <section className="news-wrap">
        <div className="news-head">
          <FaNewspaper />
          <h2>{t('news.title')}</h2>
        </div>
        <div className="loading">{t('cat.loading')}</div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="news-wrap">
        <div className="news-head">
          <FaNewspaper />
          <h2>{t('news.title')}</h2>
        </div>
        <div className="empty empty-error"><p>{t('cat.error')}</p></div>
      </section>
    )
  }

  return (
    <section className="news-wrap">
      <div className="news-head">
        <FaNewspaper />
        <h2>{t('news.title')}</h2>
      </div>

      {items.length === 0 ? (
        <div className="panel-empty news-empty">
          <p>{t('news.feedEmpty')}</p>
        </div>
      ) : (

      <div className="news-feed">
        {items.map((p) => {
          const fotos = p.fotos || []
          const likes = Object.keys(p.likes || {}).length
          const comentarios = Object.values(p.comentarios || {})
          const liked = user ? !!p.likes?.[user.uid] : false
          const isOpen = openComment === p.id
          return (
            <article key={p.id} className="news-card">
              <header className="news-card-head">
                <img src={logoUrl} alt={SITE_NAME} className="news-avatar" />
                <div>
                  <strong>{p.autor}</strong>
                  <span className="news-date">{formatDate(p.fecha, lang)}</span>
                </div>
              </header>

              {fotos.length === 1 ? (
                <img src={fotos[0]} alt="" className="news-img news-img-single" />
              ) : fotos.length > 1 ? (
                <div className={`news-grid news-grid-${Math.min(fotos.length, 6)}`}>
                  {fotos.map((f, i) => (
                    <img key={i} src={f} alt="" className="news-img" />
                  ))}
                </div>
              ) : null}

              <div className="news-body">
                {p.texto && (
                <p
                  className="news-caption"
                  dangerouslySetInnerHTML={{ __html: postHtml(p.texto) }}
                />
              )}

                <div className="news-actions">
                  <button
                    className={`news-action ${liked ? 'is-liked' : ''}`}
                    onClick={like}
                    disabled={!user}
                    title={t('news.like')}
                  >
                    <FaHeart /> <span>{likes}</span>
                  </button>
                  <button
                    className="news-action"
                    onClick={() => {
                      setOpenComment(isOpen ? null : p.id)
                    }}
                    title={t('news.comments')}
                  >
                    <FaComment /> <span>{comentarios.length}</span>
                  </button>
                  <button className="news-action" onClick={() => share(p)} title={t('news.share')}>
                    <FaShareNodes />
                  </button>
                </div>

                {isOpen && (
                  <div className="news-comments">
                    {comentarios.length === 0 ? (
                      <p className="list-sub">{t('news.noComments')}</p>
                    ) : (
                      comentarios.map((c, i) => (
                        <div key={i} className="news-comment">
                          <span className="news-comment-ava">{ini(c.nombre)}</span>
                          <div>
                            <strong>{c.nombre}</strong>
                            <p>{c.texto}</p>
                            <span className="news-date">{formatDate(c.fecha, lang)}</span>
                          </div>
                        </div>
                      ))
                    )}

                    {user ? (
                      <form className="news-comment-form" onSubmit={(e) => comment(p, e)}>
                        <input
                          className="input"
                          placeholder={t('news.writeComment')}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        />
                        <button className="btn btn-primary btn-sm" disabled={!commentText.trim()}>
                          {t('news.send')}
                        </button>
                        {sent === p.id && <p className="form-success">{t('news.commentAdded')}</p>}
                      </form>
                    ) : (
                      <p className="news-login-hint">
                        {t('news.loginToComment')}{' '}
                        <Link to="/">{t('detail.loginNow')}</Link>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
      )}
    </section>
  )
}