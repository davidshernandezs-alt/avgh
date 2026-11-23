import { getAffiliationPlan } from './affiliationDefaults'

// Determina qué plan de afiliación aplica a un perfil.
// Los empleados creados desde una empresa pueden tener afiliado=true sin plan
// explícito: en ese caso heredan el plan corporativo.
export function resolveAffiliationPlan(profile) {
  if (!profile?.afiliado) return null
  const explicit = profile.tipoAfiliacion || profile.planAfiliacion
  if (explicit === 'individual' || explicit === 'corporativo' || explicit === 'corporate') {
    return explicit === 'corporate' ? 'corporativo' : explicit
  }
  if (profile.tipoPersona === 'juridico' || profile.empresa || profile.nombreEmpresa) {
    return 'corporativo'
  }
  return 'individual'
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Calcula el precio de una inscripción aplicando el descuento del plan vigente.
// Devuelve siempre el desglose para poder guardarlo en la inscripción/factura.
// Devuelve el tipo de asistente del usuario en una actividad concreta.
export function tipoAsistenteEn(inscripciones, actividadId) {
  const ins = (inscripciones || []).find((i) => i.actividadId === actividadId)
  return ins?.tipoAsistente || ''
}

const esGratisPorTipo = (tipo) =>
  ['exonerado', 'invitado', 'junta', 'facilitador'].includes(tipo || '')

export function calcularPrecioInscripcion({ precio, profile, config, countParticipants = 1, actividad = null, tipoAsistente = '' }) {
  const precioBase = round2(precio)
  const planAfiliacion = resolveAffiliationPlan(profile) || ''
  const porcentaje = planAfiliacion
    ? Math.max(0, Math.min(100, Number(getAffiliationPlan(config, planAfiliacion)?.descuentoEventos) || 0))
    : 0

  const descuentoUnitario = porcentaje > 0 ? round2((precioBase * porcentaje) / 100) : 0
  let montoUnitario = Math.max(0, round2(precioBase - descuentoUnitario))
  let gratisAfiliados = false
  if (actividad?.gratisAfiliados && planAfiliacion) {
    montoUnitario = 0
    gratisAfiliados = true
  }
  if (esGratisPorTipo(tipoAsistente)) {
    montoUnitario = 0
    gratisAfiliados = true
  }
  const qty = Math.max(1, Number(countParticipants) || 1)
  const descuentoMonto = round2(descuentoUnitario * qty)
  const montoFinal = round2(montoUnitario * qty)

  return {
    precioBase,
    descuentoPorcentaje: porcentaje,
    descuentoUnitario,
    descuentoMonto,
    montoUnitario,
    montoFinal,
    afiliado: !!planAfiliacion,
    planAfiliacion,
    gratisAfiliados,
    countParticipants: qty
  }
}
