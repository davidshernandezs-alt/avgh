// Convierte el texto/HTML de una publicación para mostrarlo bien en pantalla.
export function postHtml(texto) {
  if (!texto) return ''
  if (!texto.includes('<')) {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')
  }
  return texto
    .replace(/<(script|iframe|object|embed|link|meta|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed|link|meta|style)(\s[^>]*)?\/?>/gi, '')
    .replace(/\s(href|src)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*'|[^\s>]*javascript:[^\s>]*)/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\sjavascript:[^\s"'<>]+/gi, '')
}

// Quita las etiquetas y devuelve solo el texto visible (para validaciones).
export function plainText(texto) {
  if (!texto) return ''
  return texto.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}