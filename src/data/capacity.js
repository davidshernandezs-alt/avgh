// Lógica central de cupos / lista de espera.
// Un inscrito OCUPA cupo si su inscripción NO está rechazada ni en lista de espera.
export const CUPOS_ILIMITADOS = 0

export function ocupaCupo(ins) {
  if (!ins) return false
  if (ins.estado === 'rechazada' || ins.listaEspera === true) return false
  return true
}

export function calcularCupo({ actividad, inscripciones = [] }) {
  const total = Math.max(0, Number(actividad?.cupo) || 0)
  const ocupados = inscripciones.filter(
    (i) => i.actividadId === actividad?.id && ocupaCupo(i)
  ).length
  const espera = inscripciones.filter(
    (i) => i.actividadId === actividad?.id && i.listaEspera === true && i.estado !== 'rechazada'
  ).length
  const ilimitado = total === CUPOS_ILIMITADOS
  const disponibles = ilimitado ? Infinity : Math.max(0, total - ocupados)
  return {
    total,
    ocupados,
    espera,
    ilimitado,
    disponibles,
    lleno: !ilimitado && disponibles <= 0
  }
}
