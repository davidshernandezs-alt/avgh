import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// Genera el carnet con QR como PDF descargable. No usa window.print(): captura
// el elemento visible con html2canvas y lo inserta en un PDF A4, evitando la
// hoja en blanco que producían las reglas de impresión del modal.
export async function downloadTicketPDF(element, fileName = 'Carnet-AVGH.pdf') {
  if (!element) throw new Error('No se encontró el carnet')

  // Clonar el carnet fuera del modal (position:fixed) para que html2canvas no
  // capture el fondo oscuro ni produzca una imagen vacía.
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;background:#fff;z-index:-1;'
  const clone = element.cloneNode(true)
  clone.style.width = '400px'
  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  let canvas
  try {
    // El QR viene de una URL externa: esperar a que termine de cargar antes de capturar.
    const images = Array.from(clone.querySelectorAll('img'))
    await Promise.all(
      images.map(
        (img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((resolve) => {
                const done = () => resolve()
                img.addEventListener('load', done, { once: true })
                img.addEventListener('error', done, { once: true })
                setTimeout(done, 4000)
              })
      )
    )

    canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 700
    })
  } finally {
    wrapper.remove()
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2
  const ratio = canvas.height / canvas.width
  let width = maxW
  let height = width * ratio
  if (height > maxH) {
    height = maxH
    width = height / ratio
  }
  const x = (pageW - width) / 2
  const y = (pageH - height) / 2

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, width, height, undefined, 'FAST')
  pdf.save(fileName)
}
