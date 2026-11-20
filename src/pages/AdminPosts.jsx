import { useState } from 'react'
import { FaNewspaper, FaImage, FaXmark, FaHeart, FaComment, FaPencil, FaTrash, FaPlus } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAuth } from '../auth/AuthContext'
import { usePosts, savePost, deletePost } from '../data/useData'
import { fileToStorable } from '../utils/files'
import { plainText, postHtml } from '../utils/html'
import { formatDate } from '../components/ActivityCard'
import RichText from '../components/RichText'

const MAX_PHOTOS = 10

function PostForm({ initial, onDone }) {
  const { t } = useLang()
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [texto, setTexto] = useState(initial?.texto || '')
  const [fotos, setFotos] = useState(initial?.fotos || [])

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (fotos.length + files.length > MAX_PHOTOS) {
      setMsg(t('news.photoLimit'))
      return
    }
    setBusy(true)
    try {
      const nuevos = []
      for (const f of files) {
        const stored = await fileToStorable(f, 900)
        nuevos.push(stored.dataUrl)
      }
      setFotos((prev) => [...prev, ...nuevos])
      setMsg('')
    } catch (err) {
      setMsg(err.message === 'too-large' ? t('admin.imageTooLarge') : t('admin.imageBadType'))
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!plainText(texto) && fotos.length === 0) {
      setMsg(t('news.formEmpty'))
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const autor = profile?.nombres
        ? `${profile.nombres} ${profile.apellidos || ''}`.trim()
        : profile?.email || 'AVGH'
      await savePost(initial?.id, {
        texto,
        fotos,
        autor,
        fecha: initial?.id ? initial.fecha : Date.now()
      })
      if (onDone) onDone()
    } catch {
      setMsg(t('admin.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">
        <FaNewspaper />
        <h3>{initial?.id ? t('news.editTitle') : t('news.newTitle')}</h3>
        {initial?.id && (
          <button type="button" className="btn-icon" onClick={() => onDone?.()}>
            <FaXmark />
          </button>
        )}
      </div>

      <label className="field-label">
        <span>{t('news.caption')}</span>
        <RichText
          value={texto}
          onChange={setTexto}
          placeholder={t('news.captionPlaceholder')}
        />
      </label>

      <div className="field-label">
        <span>{t('news.photos')} ({fotos.length}/{MAX_PHOTOS})</span>
        <div className="news-photo-grid">
          {fotos.map((foto, i) => (
            <div key={`${foto.slice(0, 40)}-${i}`} className="news-photo-slot">
              <img src={foto} alt="" />
              <button
                type="button"
                className="news-photo-remove"
                aria-label={t('news.removePhoto')}
                onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
              >
                <FaXmark />
              </button>
            </div>
          ))}
          {fotos.length < MAX_PHOTOS && (
            <label className="news-photo-add">
              <FaPlus />
              <span>{t('news.addPhoto')}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden-input"
                disabled={busy}
                onChange={addPhotos}
              />
            </label>
          )}
        </div>
      </div>

      {msg && <p className="form-error">{msg}</p>}

      <div className="news-form-actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '...' : t('news.savePost')}
        </button>
        {initial?.id && (
          <button type="button" className="btn btn-outline" onClick={() => onDone?.()}>
            {t('news.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}

export default function AdminPosts() {
  const { t, lang } = useLang()
  const { items, loading, error } = usePosts()
  const [editing, setEditing] = useState(null)

  const startNew = () => setEditing({})
  const startEdit = (p) => setEditing(p)
  const done = () => setEditing(null)

  const remove = async (p) => {
    if (!window.confirm(t('news.confirmDelete'))) return
    try {
      await deletePost(p.id)
    } catch {
      window.alert(t('admin.errorSave'))
    }
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <FaNewspaper />
          <h3>{t('admin.tabNews')}</h3>
        </div>

        {!editing && (
          <button className="btn btn-primary btn-block news-new-btn" onClick={startNew}>
            <FaPlus /> {t('news.newTitle')}
          </button>
        )}

        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : error ? (
          <div className="empty empty-error"><p>{t('cat.error')}</p></div>
        ) : items.length === 0 && !editing ? (
          <div className="panel-empty"><p>{t('news.postsEmpty')}</p></div>
        ) : null}
      </section>

      {editing && <PostForm initial={editing} onDone={done} />}

      {!editing && (
        <section className="panel">
          <div className="news-admin-list">
            {items.map((p) => (
              <div key={p.id} className="news-admin-card">
                {(p.fotos || []).slice(0, 4).map((foto, i) => (
                  <img key={i} src={foto} alt="" className="news-admin-thumb" />
                ))}
                <div className="news-admin-info">
                  <strong>{p.autor}</strong>
                  <span className="list-sub">{formatDate(p.fecha, lang)}</span>
                  <p dangerouslySetInnerHTML={{ __html: postHtml(p.texto) }} />
                  <span className="list-sub">
                    <FaHeart /> {Object.keys(p.likes || {}).length} · <FaComment />{' '}
                    {Object.keys(p.comentarios || {}).length}
                  </span>
                </div>
                <div className="member-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>
                    <FaPencil /> {t('news.editPost')}
                  </button>
                  <button className="btn btn-danger-outline btn-sm" onClick={() => remove(p)}>
                    <FaTrash /> {t('news.deletePost')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}