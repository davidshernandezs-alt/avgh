// Valores por defecto de la página de afiliación.
// El administrador puede sobrescribirlos desde el panel (config/afiliaciones).

export const AFFILIATION_DEFAULTS = {
  introTitulo: 'Forma parte de la comunidad de Gestión Humana más importante de Venezuela',
  introTexto:
    'Los asociados pueden ser individuales o corporativos. Son asociados todas aquellas personas naturales o jurídicas cuya solicitud de afiliación haya sido aprobada por la Junta Directiva Nacional.',
  individual: {
    titulo: 'Afiliación Individual',
    subtitulo: 'Persona natural',
    descripcion:
      'Para profesionales que desean fortalecer su carrera y acceder a contenido especializado.',
    precio: '$30,00 + IVA',
    precioMonto: 30,
    descuentoEventos: 10,
    precioEtiqueta: 'Inversión trimestral',
    precioNota: 'Al cambio oficial del día',
    beneficios: [
      'Acceso mediante clave a la zona VIP del portal www.avgh.org.ve, con ponencias e investigaciones exclusivas.',
      'Descuentos del 10% en las tarifas de los eventos que desarrolle la Asociación.',
      'Precios especiales en matrículas de congresos WFPMA y FIDAGH.',
      'Información de Gestión Humana actualizada de los 16 países miembros de la FIDAGH.',
      'Suscripción sin costo a la Revista virtual especializada en Gestión Humana.',
      'Entrada sin costo a charlas, desayunos, conferencias y actividades especiales para afiliados.',
      'Un día por trimestre de uso de la sala de la Asociación sin costo para reuniones.',
      'Descuento especial del 20% en el alquiler de la sala de capacitación (hasta 20 personas).',
      'Videos gratuitos de las actividades realizadas.'
    ],
    requisitos: [
      'Copia de la Cédula de Identidad.',
      'Currículo Vitae actualizado.',
      'Dos (2) referencias personales.',
      'Comprobante de depósito, transferencia o pago móvil.'
    ]
  },
  corporativo: {
    titulo: 'Afiliación Corporativa',
    subtitulo: 'Empresas y personas jurídicas',
    descripcion:
      'Para organizaciones que apuestan por el desarrollo de su talento humano y su visibilidad.',
    precio: 'Cotización a medida',
    precioMonto: 0,
    descuentoEventos: 25,
    precioEtiqueta: 'Inversión anual',
    precioNota: 'Según el tamaño de la empresa',
    beneficios: [
      'Acceso privilegiado al área VIP de www.avgh.org.ve con ponencias e investigaciones.',
      'Descuentos de 10% a 25% en las tarifas de eventos AVGH.',
      'Descuentos en la Encuesta Nacional de Salarios e informes cualitativos.',
      'Enlace directo en la web y logo de la empresa en la página principal.',
      '20% de descuento en ferias y exposiciones comerciales.',
      'Cuatro entradas de cortesía para charlas, conferencias y cócteles.',
      'Descuentos por volumen en cursos E-learning y videos grabados sin costo.',
      'Inclusión sin costo en el Directorio Comercial web.',
      'Sala de capacitación a precio especial y sala de reuniones hasta 4 veces por trimestre.',
      'Suscripción a la Revista Especializada con descuentos publicitarios.',
      'Publicación gratuita de oportunidades laborales.'
    ],
    requisitos: [
      'Copia del Registro Mercantil.',
      'Copia del RIF actualizado.',
      'Comprobante de depósito, transferencia o pago móvil.'
    ]
  }
}

// Normaliza listas guardadas en Firebase (array, objeto numérico o texto).
export function toLines(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  }
  return fallback
}

// Combina la configuración del administrador con los valores por defecto.
export function getAffiliationPlan(config, plan) {
  const defaults = AFFILIATION_DEFAULTS[plan]
  const custom = config?.[plan] || {}
  return {
    ...defaults,
    ...custom,
    beneficios:
      custom.beneficios !== undefined ? toLines(custom.beneficios) : defaults.beneficios,
    requisitos:
      custom.requisitos !== undefined ? toLines(custom.requisitos) : defaults.requisitos
  }
}
