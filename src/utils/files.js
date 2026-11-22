// Utilidades para subir archivos (foto carnet, foto de curso, comprobantes).
// Las imágenes se redimensionan para que la app de un solo archivo siga ligera;
// los PDF se guardan tal cual en base64.

export const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB

export const ACCEPTED_RECEIPT = ['image/jpeg', 'image/png', 'application/pdf']
export const ACCEPTED_PHOTO = ['image/jpeg', 'image/png']

export function extFromType(type) {
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/png') return 'png'
  return 'jpg'
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('read-error'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image-error'))
    img.src = src
  })
}

// Recorte CUADRADO para las tarjetas (1:1). Resultado: targetSize x targetSize.
export async function imageSquareCropToDataUrl(file, targetSize = 500) {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const ctx = canvas.getContext('2d')

  const minSide = Math.min(img.width, img.height)
  const startX = (img.width - minSide) / 2
  const startY = (img.height - minSide) / 2

  ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, targetSize, targetSize)

  return canvas.toDataURL('image/jpeg', 0.88)
}

// REDIMENSIONA sin recortar (respeta la proporción). Para el banner panorámico.
// maxWidth x maxHeight definen el recuadro máximo; la imagen se escala para caber.
export async function imageFitToDataUrl(file, maxWidth = 1200, maxHeight = 675) {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  return canvas.toDataURL('image/jpeg', 0.88)
}

// Convierte un archivo a data URL para guardarlo en Realtime Database.
// Imágenes -> se redimensionan. PDF -> se acepta tal cual (hasta 4 MB).
export async function fileToStorable(file, maxDim, mode = 'square') {
  if (!file) throw new Error('no-file')
  if (file.size > MAX_FILE_BYTES) throw new Error('too-large')

  if (file.type === 'application/pdf') {
    return { dataUrl: await readAsDataUrl(file), type: file.type, name: file.name }
  }
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    const dataUrl =
      mode === 'banner'
        ? await imageFitToDataUrl(file, 1200, 675)
        : await imageSquareCropToDataUrl(file, 500)
    return { dataUrl, type: 'image/jpeg', name: file.name }
  }
  throw new Error('bad-type')
}

export function isPdf(dataUrl) {
  return typeof dataUrl === 'string' && dataUrl.startsWith('data:application/pdf')
}
