import { useEffect, useState } from 'react'
import { FaCheck, FaIdCard, FaCircleInfo } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAffiliationConfig, saveAffiliationConfig } from '../data/useData'
import { AFFILIATION_DEFAULTS, toLines } from '../data/affiliationDefaults'

function buildPlanForm(custom, defaults) {
  return {
    ...defaults,
    ...(custom || {}),
    beneficios: toLines(custom?.beneficios, defaults.beneficios).join('\n'),
    requisitos: toLines(custom?.requisitos, defaults.requisitos).join('\n')
  }
}

function buildForm(config) {
  return {
    introTitulo: config?.introTitulo || AFFILIATION_DEFAULTS.introTitulo,
    introTexto: config?.introTexto || AFFILIATION_DEFAULTS.introTexto,
    individual: buildPlanForm(config?.individual, AFFILIATION_DEFAULTS.individual),
    corporativo: buildPlanForm(config?.corporativo, AFFILIATION_DEFAULTS.corporativo)
  }
}

function serializePlan(plan) {
  return {
    ...plan,
    precioMonto: Number(plan.precioMonto) || 0,
    descuentoEventos: Math.max(0, Math.min(100, Number(plan.descuentoEventos) || 0)),
    beneficios: toLines(plan.beneficios),
    requisitos: toLines(plan.requisitos)
  }
}

export default function AdminAffiliationConfig() {
  const { t } = useLang()
  const { config, loading } = useAffiliationConfig()
  const [form, setForm] = useState(() => buildForm(null))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(buildForm(config))
  }, [config])

  const updatePlan = (plan, key, value) =>
    setForm((prev) => ({ ...prev, [plan]: { ...prev[plan], [key]: value } }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    setError('')
    try {
      await saveAffiliationConfig({
        introTitulo: form.introTitulo.trim(),
        introTexto: form.introTexto.trim(),
        individual: serializePlan(form.individual),
        corporativo: serializePlan(form.corporativo)
      })
      setMsg('Configuración guardada. La página de afiliación se actualizará automáticamente.')
    } catch (err) {
      console.error(err)
      setError(t('admin.errorSave'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="loading">{t('cat.loading')}</div>

  return (
    <section className="panel">
      <div className="panel-head">
        <FaIdCard />
        <h3>Información y costos de afiliación</h3>
      </div>
      <p className="auth-hint">
        Estos textos, costos, beneficios y requisitos son los que se muestran en la página pública de afiliación.
        Los datos bancarios, las instrucciones de pago y los términos se editan en la pestaña{' '}
        <strong>Bancos y Términos</strong>.
      </p>

      <form className="form form-pad" onSubmit={save}>
        <div className="admin-aff-note">
          <FaCircleInfo />
          <span>
            Escribe un beneficio o requisito por línea. Los cambios se publican al guardar.
          </span>
        </div>

        <div className="admin-aff-note admin-aff-note-important">
          <FaCircleInfo />
          <span>
            Importante: si el admin cambia el % después, solo afecta inscripciones nuevas; las facturas ya emitidas conservan su monto (no se recalculan).
          </span>
        </div>

        <h4>Presentación general</h4>
        <label className="field-label">
          <span>Título principal</span>
          <input
            className="input"
            value={form.introTitulo}
            onChange={(e) => setForm((prev) => ({ ...prev, introTitulo: e.target.value }))}
          />
        </label>
        <label className="field-label">
          <span>Texto introductorio</span>
          <textarea
            className="input"
            rows="3"
            value={form.introTexto}
            onChange={(e) => setForm((prev) => ({ ...prev, introTexto: e.target.value }))}
          />
        </label>

        <div className="admin-aff-grid">
          {['individual', 'corporativo'].map((planKey) => {
            const plan = form[planKey]
            const planName = planKey === 'individual' ? 'Individual' : 'Corporativa'
            return (
              <div className="admin-aff-card" key={planKey}>
                <h4>Afiliación {planName}</h4>

                <div className="field-row">
                  <label className="field-label">
                    <span>Título visible</span>
                    <input
                      className="input"
                      value={plan.titulo}
                      onChange={(e) => updatePlan(planKey, 'titulo', e.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    <span>Subtítulo / pestaña</span>
                    <input
                      className="input"
                      value={plan.subtitulo}
                      onChange={(e) => updatePlan(planKey, 'subtitulo', e.target.value)}
                    />
                  </label>
                </div>

                <label className="field-label">
                  <span>Descripción del plan</span>
                  <textarea
                    className="input"
                    rows="2"
                    value={plan.descripcion}
                    onChange={(e) => updatePlan(planKey, 'descripcion', e.target.value)}
                  />
                </label>

                <div className="field-row">
                  <label className="field-label">
                    <span>Costo / precio</span>
                    <input
                      className="input"
                      value={plan.precio}
                      onChange={(e) => updatePlan(planKey, 'precio', e.target.value)}
                      placeholder="Ej. $30,00 + IVA"
                    />
                  </label>
                  <label className="field-label">
                    <span>Etiqueta del costo</span>
                    <input
                      className="input"
                      value={plan.precioEtiqueta}
                      onChange={(e) => updatePlan(planKey, 'precioEtiqueta', e.target.value)}
                      placeholder="Ej. Inversión trimestral"
                    />
                  </label>
                </div>

                <label className="field-label">
                  <span>Nota del costo</span>
                  <input
                    className="input"
                    value={plan.precioNota}
                    onChange={(e) => updatePlan(planKey, 'precioNota', e.target.value)}
                    placeholder="Ej. Al cambio oficial del día"
                  />
                </label>

                <label className="field-label">
                  <span>Monto numérico para facturación</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={plan.precioMonto ?? 0}
                    onChange={(e) => updatePlan(planKey, 'precioMonto', e.target.value)}
                    placeholder="Ej. 30"
                  />
                  <em>
                    Este monto se usa en la factura y en los totales de Facturación / Pagos. Usa 0 si el
                    plan es cotización a medida.
                  </em>
                </label>

                <label className="field-label">
                  <span>Descuento en eventos, cursos y talleres (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="input"
                    value={plan.descuentoEventos ?? 0}
                    onChange={(e) => updatePlan(planKey, 'descuentoEventos', e.target.value)}
                    placeholder="Ej. 10"
                  />
                  <em>
                    Se aplica al inscribirse a actividades AVGH si el participante está afiliado a este plan.
                    Quien no esté afiliado paga el precio regular.
                  </em>
                </label>

                <label className="field-label">
                  <span>Beneficios (uno por línea)</span>
                  <textarea
                    className="input"
                    rows="8"
                    value={plan.beneficios}
                    onChange={(e) => updatePlan(planKey, 'beneficios', e.target.value)}
                  />
                </label>

                <label className="field-label">
                  <span>Requisitos y recaudos (uno por línea)</span>
                  <textarea
                    className="input"
                    rows="4"
                    value={plan.requisitos}
                    onChange={(e) => updatePlan(planKey, 'requisitos', e.target.value)}
                  />
                </label>
              </div>
            )
          })}
        </div>

        {msg && <p className="form-success">{msg}</p>}
        {error && <p className="form-error">{error}</p>}

        <div className="btn-row" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '...' : <><FaCheck /> Guardar configuración</>}
          </button>
        </div>
      </form>
    </section>
  )
}
