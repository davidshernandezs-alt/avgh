import { useState } from 'react'
import { FaUsers, FaXmark, FaBuilding, FaUser, FaBan, FaUserSlash, FaLockOpen, FaTrash } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { useAllUsers, useAllCompaniesEmployees, setUserEstado, deleteUserAccount } from '../data/useData'
import { formatDate } from '../components/ActivityCard'

function clientName(user) {
  const full = `${user?.nombres || ''} ${user?.apellidos || ''}`.trim()
  if (user?.tipoPersona === 'juridico') return user.nombreEmpresa || full || user?.email || '?'
  return full || user?.email || '?'
}

function TypeBadge({ user }) {
  const { t } = useLang()
  const tipo = user?.tipoPersona === 'juridico' ? 'juridico' : 'natural'
  return (
    <span className={`badge badge-type ${tipo === 'juridico' ? 'badge-type-juridico' : ''}`}>
      {tipo === 'juridico' ? <FaBuilding /> : <FaUser />} {t(`admin.memberType.${tipo}`)}
    </span>
  )
}

function StatusBadge({ user }) {
  const { t } = useLang()
  if (user?.bloqueado) return <span className="badge badge-bloqueado"><FaBan /> {t('admin.memberBlocked')}</span>
  if (user?.afiliado === false) return <span className="badge badge-noafiliado"><FaUserSlash /> {t('admin.memberNoAffiliate')}</span>
  return <span className="badge badge-activo">{t('admin.memberActive')}</span>
}

function planLabel(tipo) {
  return tipo === 'corporativo' ? 'Corporativo' : 'Individual'
}

export default function AdminMembers() {
  const { t, lang } = useLang()
  const { items, loading, error } = useAllUsers()
  const { employees: allEmployees, loading: loadingEmp } = useAllCompaniesEmployees()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(null)
  const [planDraft, setPlanDraft] = useState({})

  const members = items.filter((u) => u.rol !== 'admin')
  const list =
    filter === 'all'
      ? members
      : members.filter((u) => (u.tipoPersona || 'natural') === filter)

  const row = selected ? members.find((m) => m.uid === selected) : null

  const removeUser = async (uid) => {
    if (!window.confirm(t('admin.confirmDeleteUser') || '¿Estás seguro de eliminar permanentemente a este afiliado y todos sus datos e inscripciones?')) return
    setBusy(uid)
    try {
      await deleteUserAccount(uid)
      setSelected(null)
    } catch {
      window.alert(t('admin.errorSave') || 'Error')
    } finally {
      setBusy(null)
    }
  }

  const run = async (uid, confirmKey, fields) => {
    if (!window.confirm(t(confirmKey))) return
    setBusy(uid)
    try {
      await setUserEstado(uid, fields)
    } catch {
      window.alert(t('admin.errorSave') || 'Error')
    } finally {
      setBusy(null)
    }
  }

  const planFor = (uid, fallback = 'individual') => planDraft[uid] || fallback || 'individual'

  const makeAffiliate = async (member) => {
    const plan = planFor(member.uid, member.tipoAfiliacion)
    if (!window.confirm(`¿Convertir a ${clientName(member)} en afiliado ${planLabel(plan).toLowerCase()}?`)) return
    setBusy(member.uid)
    try {
      await setUserEstado(member.uid, {
        afiliado: true,
        tipoAfiliacion: plan,
        planAfiliacion: plan,
        afiliadoDesde: Date.now(),
        onboardingCompleted: true
      })
    } catch {
      window.alert(t('admin.errorSave') || 'Error')
    } finally {
      setBusy(null)
    }
  }

  const changePlan = async (member) => {
    const plan = planFor(member.uid, member.tipoAfiliacion)
    setBusy(member.uid)
    try {
      await setUserEstado(member.uid, {
        afiliado: true,
        tipoAfiliacion: plan,
        planAfiliacion: plan
      })
    } catch {
      window.alert(t('admin.errorSave') || 'Error')
    } finally {
      setBusy(null)
    }
  }

  if (error) return <div className="empty empty-error"><p>{t('cat.error')}</p></div>

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <FaUsers />
          <h3>{t('admin.membersTitle')}</h3>
        </div>

        <div className="radio-group filter-tipo">
          {['all', 'natural', 'juridico'].map((f) => (
            <label key={f} className={`radio-card ${filter === f ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="memberFilter"
                value={f}
                checked={filter === f}
                onChange={() => setFilter(f)}
              />
              <span>{t(`admin.membersFilter.${f}`)}</span>
            </label>
          ))}
        </div>

        {loading ? (
          <div className="loading">{t('cat.loading')}</div>
        ) : list.length === 0 ? (
          <div className="panel-empty"><p>{t('admin.membersEmpty')}</p></div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.table.student')}</th>
                  <th>{t('home.email')}</th>
                  <th>{t('profile.personType')}</th>
                  <th>Plan de afiliación</th>
                  <th>{t('admin.memberSince')}</th>
                  <th>{t('admin.memberStatus')}</th>
                  <th>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <div className="admin-student">
                        {u.foto ? (
                          <img src={u.foto} alt="" className="admin-thumb" />
                        ) : (
                          <span className="admin-thumb admin-thumb-initial">{clientName(u).charAt(0)}</span>
                        )}
                        <div>
                          <strong>{clientName(u)}</strong>
                          <span className="list-sub">{u.nombres} {u.apellidos}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><TypeBadge user={u} /></td>
                    <td>
                      {u.afiliado === false ? (
                        <span className="badge badge-noafiliado">Sin plan</span>
                      ) : (
                        <span className="badge badge-type">{planLabel(u.tipoAfiliacion)}</span>
                      )}
                    </td>
                    <td>{formatDate(u.fechaRegistro, lang)}</td>
                    <td><StatusBadge user={u} /></td>
                    <td>
                      <div className="member-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => setSelected(u.uid)}>
                          {t('admin.view')}
                        </button>
                        {u.afiliado === false ? (
                          <>
                            <select
                              className="input"
                              style={{ maxWidth: '130px' }}
                              value={planFor(u.uid, u.tipoAfiliacion)}
                              onChange={(event) =>
                                setPlanDraft((prev) => ({ ...prev, [u.uid]: event.target.value }))
                              }
                              aria-label="Plan de afiliación"
                            >
                              <option value="individual">Individual</option>
                              <option value="corporativo">Corporativo</option>
                            </select>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={busy === u.uid}
                              onClick={() => makeAffiliate(u)}
                            >
                              Hacer afiliado
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={busy === u.uid}
                            onClick={() =>
                              run(u.uid, 'admin.confirmDeaffiliate', {
                                afiliado: false,
                                tipoAfiliacion: null,
                                planAfiliacion: null,
                                afiliadoDesde: null
                              })
                            }
                          >
                            <FaUserSlash /> {t('admin.deaffiliateMember')}
                          </button>
                        )}
                        <button
                          className={`btn btn-sm ${u.bloqueado ? 'btn-outline' : 'btn-danger-outline'}`}
                          disabled={busy === u.uid}
                          onClick={() =>
                            u.bloqueado
                              ? run(u.uid, 'admin.confirmUnblock', { bloqueado: false })
                              : run(u.uid, 'admin.confirmBlock', { bloqueado: true, bloqueadoFecha: Date.now() })
                          }
                        >
                          {u.bloqueado ? <FaLockOpen /> : <FaBan />}
                          {u.bloqueado ? t('admin.unblockMember') : t('admin.blockMember')}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busy === u.uid}
                          onClick={() => removeUser(u.uid)}
                          title={t('admin.deleteMember') || 'Eliminar'}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {row && (
        <div className="qr-modal-backdrop admin-review-backdrop" onClick={() => setSelected(null)}>
          <section className="panel admin-detail" onClick={(e) => e.stopPropagation()}>
            <div className="admin-detail-head">
            <h3>{t('admin.view')} — {clientName(row)}</h3>
            <button className="btn-icon" onClick={() => setSelected(null)} aria-label={t('admin.close')}>
              <FaXmark />
            </button>
          </div>

          <div className="admin-grid">
            <div className="admin-section">
              <h4>{t('profile.personType')}</h4>
              <TypeBadge user={row} />
              <div className="admin-student">
                {row.foto ? (
                  <img src={row.foto} alt="" className="admin-thumb admin-thumb-lg" />
                ) : (
                  <span className="admin-thumb admin-thumb-initial admin-thumb-lg">
                    {`${row.nombres?.[0] || '?'}${row.apellidos?.[0] || ''}`.toUpperCase()}
                  </span>
                )}
              </div>
              <ul className="admin-list">
                <li><strong>{t('admin.memberStatus')}:</strong> <StatusBadge user={row} /></li>
                <li>
                  <strong>Plan de afiliación:</strong>{' '}
                  {row.afiliado === false ? 'Sin plan' : planLabel(row.tipoAfiliacion)}
                </li>
                {row.afiliadoDesde && (
                  <li><strong>Afiliado desde:</strong> {formatDate(row.afiliadoDesde, lang)}</li>
                )}
                <li><strong>{t('home.email')}:</strong> {row.email || t('admin.notProvided')}</li>
                {row.telefonoCelular && <li><strong>{t('home.telefonoCelular')}:</strong> {row.telefonoCelular}</li>}
                {row.telefono && <li><strong>{t('home.phone')}:</strong> {row.telefono}</li>}
                {row.cedula && <li><strong>{t('home.cedula')}:</strong> {row.cedula}</li>}
                {row.dni && <li><strong>{t('profile.dni')}:</strong> {row.dni}</li>}
                {row.edad && <li><strong>{t('profile.age')}:</strong> {row.edad}</li>}
                {row.sexo && <li><strong>{t('profile.sex')}:</strong> {t(`profile.sex.${row.sexo}`)}</li>}
              </ul>
            </div>

            {row.tipoPersona === 'juridico' && (
              <div className="admin-section">
                <h4>{t('home.companyData')}</h4>
                <ul className="admin-list">
                  <li><strong>{t('home.rif')}:</strong> {row.rif || t('admin.notProvided')}</li>
                  <li><strong>{t('home.nombreEmpresa')}:</strong> {row.nombreEmpresa || t('admin.notProvided')}</li>
                  <li><strong>{t('home.cargo')}:</strong> {row.cargo || t('admin.notProvided')}</li>
                  <li><strong>{t('home.telefonoEmpresa')}:</strong> {row.telefonoEmpresa || t('admin.notProvided')}</li>
                  <li><strong>{t('home.direccionFiscal')}:</strong> {row.direccionFiscal || t('admin.notProvided')}</li>
                  <li><strong>{t('home.direccionOficina')}:</strong> {row.direccionOficina || t('admin.notProvided')}</li>
                  <li><strong>{t('home.contactoFacturaNombre')}:</strong> {row.contactoFacturaNombre || t('admin.notProvided')}</li>
                  <li><strong>{t('home.contactoFacturaEmail')}:</strong> {row.contactoFacturaEmail || t('admin.notProvided')}</li>
                  <li><strong>{t('home.responsableNombre')}:</strong> {row.responsableNombre || t('admin.notProvided')}</li>
                  <li><strong>{t('home.responsableTelefono')}:</strong> {row.responsableTelefono || t('admin.notProvided')}</li>
                  <li><strong>{t('home.comoSeEntero')}:</strong> {row.comoSeEntero ? t(`home.comoSeEntero.${row.comoSeEntero}`) : t('admin.notProvided')}</li>
                </ul>

                {/* Mostrar empleados cargados por esta empresa en un acordeón/desplegable */}
                <details style={{ marginTop: '20px', background: 'var(--bg-muted)', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>
                  <summary style={{ fontWeight: 600, outline: 'none' }}>
                    Empleados Registrados ({allEmployees.filter((e) => e.companyUid === row.uid).length})
                  </summary>
                  {allEmployees.filter((e) => e.companyUid === row.uid).length === 0 ? (
                    <p className="list-sub" style={{ marginTop: '10px' }}>No hay empleados registrados en la plantilla de esta empresa.</p>
                  ) : (
                    <ul className="admin-list" style={{ marginTop: '10px' }}>
                      {allEmployees
                        .filter((e) => e.companyUid === row.uid)
                        .map((emp) => (
                          <li key={emp.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                            <strong>{emp.nombres} {emp.apellidos}</strong><br />
                            <small>Cédula: {emp.dni} · Cargo: {emp.cargo || 'N/D'} · Email: {emp.email || 'N/D'}</small>
                          </li>
                        ))}
                    </ul>
                  )}
                </details>
              </div>
            )}

            <div className="admin-section">
              <h4>Registro</h4>
              <ul className="admin-list">
                <li><strong>{t('admin.memberSince')}:</strong> {formatDate(row.fechaRegistro, lang)}</li>
              </ul>
              <div className="member-actions">
                <select
                  className="input"
                  style={{ maxWidth: '140px' }}
                  value={planFor(row.uid, row.tipoAfiliacion)}
                  onChange={(event) =>
                    setPlanDraft((prev) => ({ ...prev, [row.uid]: event.target.value }))
                  }
                  aria-label="Plan de afiliación"
                >
                  <option value="individual">Individual</option>
                  <option value="corporativo">Corporativo</option>
                </select>
                {row.afiliado === false ? (
                  <button
                    className="btn btn-outline"
                    disabled={busy === row.uid}
                    onClick={() => makeAffiliate(row)}
                  >
                    Hacer afiliado
                  </button>
                ) : (
                  <button
                    className="btn btn-outline"
                    disabled={busy === row.uid}
                    onClick={() => changePlan(row)}
                  >
                    Actualizar plan
                  </button>
                )}
                <button
                  className={`btn ${row.bloqueado ? 'btn-outline' : 'btn-danger'}`}
                  disabled={busy === row.uid}
                  onClick={() =>
                    row.bloqueado
                      ? run(row.uid, 'admin.confirmUnblock', { bloqueado: false })
                      : run(row.uid, 'admin.confirmBlock', { bloqueado: true, bloqueadoFecha: Date.now() })
                  }
                >
                  {row.bloqueado ? <FaLockOpen /> : <FaBan />}
                  {row.bloqueado ? t('admin.unblockMember') : t('admin.blockMember')}
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy === row.uid}
                  onClick={() => removeUser(row.uid)}
                >
                  <FaTrash /> {t('admin.deleteMember') || 'Eliminar Afiliado'}
                </button>
              </div>
            </div>
          </div>
          </section>
        </div>
      )}
    </>
  )
}