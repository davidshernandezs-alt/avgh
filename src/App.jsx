import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { FaBan } from 'react-icons/fa6'
import { useLang } from './i18n'
import { useAuth } from './auth/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Footer from './components/Footer'
import PwaInstallBanner from './components/PwaInstallBanner'
import { OnboardingModal } from './components/OnboardingModal'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import ActivityDetail from './pages/ActivityDetail'
import InscriptionPage from './pages/InscriptionPage'
import Profile from './pages/Profile'
import AffiliationPage from './pages/AffiliationPage'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'

function BlockedView() {
  const { t } = useLang()
  const { clearBlocked } = useAuth()
  return (
    <div className="blocked-screen">
      <div className="blocked-card">
        <FaBan className="blocked-icon" />
        <h1>{t('blocked.title')}</h1>
        <p>{t('blocked.msg')}</p>
        <button className="btn btn-primary" onClick={clearBlocked}>
          {t('blocked.logout')}
        </button>
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  const { t } = useLang()

  if (loading) return <div className="page"><div className="loading">{t('cat.loading')}</div></div>
  if (!user)
    return (
      <div className="page">
        <div className="empty">
          <p>{t('insc.pleaseLogin')}</p>
          <a href="#/" className="btn btn-primary btn-block">
            {t('detail.loginNow')}
          </a>
        </div>
      </div>
    )
  return children
}

function AdminGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const { t } = useLang()

  if (loading) return <div className="page"><div className="loading">{t('cat.loading')}</div></div>
  if (!user || profile?.rol !== 'admin')
    return (
      <div className="page">
        <div className="empty empty-error">
          <p>{t('admin.notAdmin')}</p>
          <a href="#/admin" className="btn btn-primary btn-block">
            {t('admin.title')}
          </a>
        </div>
      </div>
    )
  return children
}

function AppInner() {
  const { blocked } = useAuth()

  if (blocked) return <BlockedView />

  return (
    <div className="app-shell">
      <Header />
      <OnboardingModal />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog/:tipo" element={<Catalog />} />
          <Route path="/afiliacion" element={<AffiliationPage />} />
          <Route path="/actividad/:tipo/:id" element={<ActivityDetail />} />
          <Route path="/inscribirse/:tipo/:id" element={<InscriptionPage />} />
          <Route
            path="/perfil"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/panel"
            element={
              <AdminGuard>
                <AdminPanel />
              </AdminGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <PwaInstallBanner />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ScrollToTop />
        <AppInner />
      </HashRouter>
    </ErrorBoundary>
  )
}