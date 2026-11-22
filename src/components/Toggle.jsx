export default function Toggle({ checked, onChange, label, id }) {
  return (
    <label className="toggle-row" htmlFor={id}>
      {label && <span className="toggle-label">{label}</span>}
      <span className="toggle-switch">
        <input
          id={id}
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </span>
    </label>
  )
}
