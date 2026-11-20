import { FaXmark, FaPrint, FaCircleCheck } from 'react-icons/fa6'
import { useLang } from '../i18n'
import { localize } from '../utils/localized'
import { formatDate } from '../components/ActivityCard'
import { SITE_NAME } from '../config'
import logoUrl from '../assets/avgh_logo.png'

export default function TicketModal({ user, insc, act, factura, onClose }) {
  const { t, lang } = useLang()
  const title = localize(act?.titulo, lang)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`AVGH|${user?.uid}|${act?.id || insc?.actividadId}`)}`

  const handlePrint = () => {
    document.body.classList.add('printing-ticket')
    window.print()
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-ticket'), { once: true })
  }

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal ticket-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-detail-head no-print">
          <h3>{t('profile.qrTicket')}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('admin.close')}>
            <FaXmark />
          </button>
        </div>

        <div className="ticket-body" id="printable-ticket">
          <div className="ticket-header">
            <img src={logoUrl} alt={SITE_NAME} className="ticket-logo" />
            <h2>{SITE_NAME}</h2>
            <p>Asociación Venezolana de Gestión Humana</p>
          </div>

          <div className="ticket-status is-paid">
            <FaCircleCheck /> <span>PAGADO Y CONFIRMADO</span>
          </div>

          <div className="ticket-info">
            <div className="ticket-row">
              <span>Participante:</span>
              <strong>{user?.nombres || ''} {user?.apellidos || ''} {user?.nombreEmpresa ? `(${user.nombreEmpresa})` : ''}</strong>
            </div>
            <div className="ticket-row">
              <span>Correo:</span>
              <strong>{user?.email}</strong>
            </div>
            <div className="ticket-row">
              <span>Curso / Actividad:</span>
              <strong>{title}</strong>
            </div>
            <div className="ticket-row">
              <span>Fecha de inscripción:</span>
              <strong>{formatDate(insc?.fecha, lang)}</strong>
            </div>
            <div className="ticket-row">
              <span>Monto pagado:</span>
              <strong>${insc?.monto || factura?.monto || 0}</strong>
            </div>
          </div>

          <div className="ticket-qr-section">
            <img src={qrUrl} alt="QR Code" className="ticket-qr-img" />
            <span className="ticket-qr-hint">Presente este código QR al ingresar a la actividad</span>
          </div>
        </div>

        <div className="ticket-actions no-print">
          <button className="btn btn-primary btn-block" onClick={handlePrint}>
            <FaPrint /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>
    </div>
  )
}