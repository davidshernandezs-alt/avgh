import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ref, update } from 'firebase/database'
import { db, DB_ROOT } from '../firebase'

export function OnboardingModal() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (user && profile && profile.rol !== 'admin' && profile.onboardingCompleted !== true) {
      setShow(true)
    } else {
      setShow(false)
    }
  }, [user, profile])

  if (!show) return null

  const markCompleted = async (updates) => {
    try {
      await update(ref(db, `${DB_ROOT}/users/${user.uid}`), {
        ...updates,
        onboardingCompleted: true
      })
      setShow(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleAnswer = async (isAfiliado) => {
    await markCompleted({ afiliado: isAfiliado })
    if (isAfiliado) {
      navigate('/perfil')
    } else {
      // La afiliación vive en su propia página, sin modales emergentes.
      navigate('/afiliacion')
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center', padding: '32px' }}>
        <h2 id="onboarding-title" style={{ marginBottom: '16px', color: 'var(--navy)' }}>
          Bienvenido a AVGH
        </h2>
        <p style={{ fontSize: '16px', marginBottom: '24px', lineHeight: '1.5' }}>
          ¿Es usted afiliado a la Asociación Venezolana de Gestión Humana (AVGH)?
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ minWidth: '120px' }} onClick={() => handleAnswer(true)}>
            Sí
          </button>
          <button className="btn btn-outline" style={{ minWidth: '120px' }} onClick={() => handleAnswer(false)}>
            No
          </button>
        </div>
      </div>
    </div>
  )
}
