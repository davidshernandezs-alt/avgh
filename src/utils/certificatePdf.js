import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// Genera un PDF de exactamente 2 páginas (A4 apaisado), una por cada hoja del
// certificado. Se captura cada hoja con su fondo real para que no salga blanco.
export async function downloadCertificatePDF(container, fileName = 'Certificado-AVGH.pdf') {
  if (!container) throw new Error('No se encontró el certificado')
  const pages = Array.from(container.querySelectorAll('.certificate-page'))
  if (!pages.length) throw new Error('No se encontraron las hojas del certificado')

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })

  for (let i = 0; i < pages.length; i += 1) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#fdf6e3',
      logging: false,
      width: pages[i].scrollWidth,
      height: pages[i].scrollHeight,
      windowWidth: 1200,
      onclone: (doc) => {
        // Si la vista está escalada para celular, capturamos sin transform
        const scaler = doc.querySelector('.certificate-scaler')
        if (scaler) {
          scaler.style.transform = 'none'
          scaler.style.height = 'auto'
        }
      }
    })
    const img = canvas.toDataURL('image/jpeg', 0.95)
    if (i > 0) pdf.addPage('a4', 'landscape')
    pdf.addImage(img, 'JPEG', 0, 0, 297, 210, undefined, 'FAST')
  }

  pdf.save(fileName)
}
