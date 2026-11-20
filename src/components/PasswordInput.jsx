import { useState } from 'react'
import { FaLock, FaEye, FaEyeSlash } from 'react-icons/fa6'

export default function PasswordInput({ value, onChange, placeholder, autoComplete, required }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <FaLock className="field-icon" />
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="input-with-toggle"
        required={required}
      />
      <button
        type="button"
        className="field-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar' : 'Mostrar'}
      >
        {visible ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
  )
}