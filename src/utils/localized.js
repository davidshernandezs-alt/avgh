// Devuelve el texto en el idioma activo con respaldo al español.

export function localize(value, lang) {
  if (!value) return ''
  if (typeof value !== 'object') return String(value)
  return value[lang] || value.es || ''
}