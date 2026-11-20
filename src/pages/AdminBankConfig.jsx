import { useState, useEffect } from 'react'
import { FaBuildingColumns, FaCheck, FaCopy } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useBankConfig, saveBankConfig } from '../data/useData'

export default function AdminBankConfig() {
  const { t } = useLang()
  const { config, loading } = useBankConfig()
  const [form, setForm] = useState({
    bancoNombre: '',
    tipoCuenta: 'Corriente',
    numeroCuenta: '',
    beneficiario: '',
    rifCedula: '',
    pagoMovilBanco: '',
    pagoMovilTelefono: '',
    pagoMovilRif: '',
    observaciones: '',
    terminosCondiciones: ''
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(false)

  useEffect(() => {
    if (config) {
      setForm((prev) => ({ ...prev, ...config }))
    }
  }, [config])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(false)
    try {
      await saveBankConfig(form)
      setMsg(true)
      setTimeout(() => setMsg(false), 3000)
    } catch {
      alert(t('admin.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="loading">{t('cat.loading')}</div>

  return (
    <section className="panel">
      <div className="panel-head">
        <FaBuildingColumns />
        <h3>{t('admin.tabBank')}</h3>
      </div>
      <p className="auth-hint">{t('admin.bankHint')}</p>

      <form className="form form-pad" onSubmit={save}>
        <h4>Transferencia Bancaria</h4>
        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.bankName')}</span>
            <input className="input" value={form.bancoNombre} onChange={set('bancoNombre')} placeholder="Ej. Banco Banesco" />
          </label>
          <label className="field-label">
            <span>{t('admin.bankType')}</span>
            <input className="input" value={form.tipoCuenta} onChange={set('tipoCuenta')} placeholder="Corriente / Ahorro" />
          </label>
        </div>
        <label className="field-label">
          <span>{t('admin.bankNumber')}</span>
          <input className="input" value={form.numeroCuenta} onChange={set('numeroCuenta')} placeholder="0102-..." />
        </label>
        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.bankHolder')}</span>
            <input className="input" value={form.beneficiario} onChange={set('beneficiario')} placeholder="Asociación..." />
          </label>
          <label className="field-label">
            <span>{t('admin.bankRif')}</span>
            <input className="input" value={form.rifCedula} onChange={set('rifCedula')} placeholder="J-12345678-9" />
          </label>
        </div>

        <h4 style={{ marginTop: '16px' }}>Pago Móvil</h4>
        <div className="field-row">
          <label className="field-label">
            <span>{t('admin.pmBank')}</span>
            <input className="input" value={form.pagoMovilBanco} onChange={set('pagoMovilBanco')} placeholder="Ej. Banesco (0102)" />
          </label>
          <label className="field-label">
            <span>{t('admin.pmPhone')}</span>
            <input className="input" value={form.pagoMovilTelefono} onChange={set('pagoMovilTelefono')} placeholder="0412-1234567" />
          </label>
        </div>
        <label className="field-label">
          <span>{t('admin.pmRif')}</span>
          <input className="input" value={form.pagoMovilRif} onChange={set('pagoMovilRif')} placeholder="J-12345678-9" />
        </label>

        <h4 style={{ marginTop: '16px' }}>Binance Pay / Cripto (Opcional)</h4>
        <div className="field-row">
          <label className="field-label">
            <span>Binance Pay ID / Correo</span>
            <input className="input" value={form.binanceId || ''} onChange={set('binanceId')} placeholder="Ej. 123456789 o correo@binance.com" />
          </label>
          <label className="field-label">
            <span>Binance Pay Alias / Nombre</span>
            <input className="input" value={form.binanceName || ''} onChange={set('binanceName')} placeholder="AVGH" />
          </label>
        </div>

        <h4 style={{ marginTop: '16px' }}>Zelle / Internacional (Opcional)</h4>
        <div className="field-row">
          <label className="field-label">
            <span>Zelle Email / Teléfono</span>
            <input className="input" value={form.zelleEmail} onChange={set('zelleEmail')} placeholder="pagos@avgh.org" />
          </label>
          <label className="field-label">
            <span>Zelle Titular</span>
            <input className="input" value={form.zelleTitular} onChange={set('zelleTitular')} placeholder="AVGH" />
          </label>
        </div>

        <label className="field-label" style={{ marginTop: '12px' }}>
          <span>{t('admin.bankNotes')}</span>
          <textarea className="input" rows="2" value={form.observaciones} onChange={set('observaciones')} placeholder="Instrucciones adicionales para el reporte del pago..." />
        </label>

        <h4 style={{ marginTop: '16px' }}>Enlace o QR para Compartir la App (Opcional)</h4>
        <p className="auth-hint" style={{ marginTop: '4px', marginBottom: '8px' }}>
          Configura la URL pública de la aplicación para que los usuarios puedan escanear el código QR y acceder fácilmente.
        </p>
        <div className="field-label">
          <span>URL Pública de la Aplicación</span>
          <input className="input" value={form.appUrl || ''} onChange={set('appUrl')} placeholder="https://tu-app.vercel.app" />
        </div>

        {form.appUrl && (
          <div style={{ textAlign: 'center', margin: '14px 0', padding: '14px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
            <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Código QR para compartir la aplicación:</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(form.appUrl)}`}
              alt="QR App AVGH"
              style={{ width: '160px', height: '160px', borderRadius: '8px', border: '2px solid var(--blue)' }}
            />
            <p className="auth-hint" style={{ fontSize: '12px', marginTop: '6px' }}>{form.appUrl}</p>
          </div>
        )}

        <h4 style={{ marginTop: '16px' }}>Términos y Condiciones</h4>
        <label className="field-label" style={{ marginTop: '8px' }}>
          <span>{t('admin.termsLabel')}</span>
          <textarea
            className="input"
            rows="5"
            value={form.terminosCondiciones || ''}
            onChange={set('terminosCondiciones')}
            placeholder="Escribe aquí los términos y condiciones que los usuarios deben aceptar al inscribirse..."
          />
        </label>

        {msg && <p className="form-success">{t('profile.saved')}</p>}

        <div className="btn-row" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '...' : <><FaCheck /> {t('profile.save')}</>}
          </button>
        </div>
      </form>
    </section>
  )
}