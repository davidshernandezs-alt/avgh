// Utilidades para ver y descargar comprobantes guardados como data URL en RTDB.
// Los navegadores bloquean navegar a URIs data: con target="_blank" (pestaña en
// blanco). Convertimos a blob: (sí navega) y ofrecemos descarga real.

export function getReceipt(dataUrl) {
  if (!dataUrl) return null
  if (typeof dataUrl === 'string') return { url: dataUrl, name: '', type: '' }
  if (typeof dataUrl === 'object' && dataUrl.dataUrl) {
    return { url: dataUrl.dataUrl, name: dataUrl.name || '', type: dataUrl.type || '' }
  }
  return null
}

export function extFromMime(mime) {
  if (!mime) return 'jpg'
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('png')) return 'png'
  return 'jpg'
}

export function isPdfUrl(dataUrl) {
  return String(dataUrl || '').startsWith('data:application/pdf')
}

export function fileNameFor(receipt, fallback = 'comprobante') {
  const base = (receipt?.name || fallback).replace(/\.[^.]+$/, '')
  return `${base}.${extFromMime(receipt?.type || (isPdfUrl(receipt?.url) ? 'application/pdf' : ''))}`
}

export async function toObjectUrl(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  return URL.createObjectURL(blob)
}

export async function viewReceipt(receipt) {
  const r = getReceipt(receipt)
  if (!r) return
  const url = await toObjectUrl(r.url)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) window.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export function downloadReceipt(receipt, fallback) {
  const r = getReceipt(receipt)
  if (!r) return
  const a = document.createElement('a')
  a.href = r.url
  a.download = fileNameFor(r, fallback)
  document.body.appendChild(a)
  a.click()
  a.remove()
}
