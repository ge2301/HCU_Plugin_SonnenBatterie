export default function PowerCard({ title, value, unit, tone, hint, icon: Icon }) {
  const display = value == null ? "–" : Math.round(value).toLocaleString("de-DE");

  return (
    <div className={`card power-card tone-${tone}`}>
      <h3>
        {Icon && <Icon size={20} className="card-icon" />}
        {title}
      </h3>
      <div className="power-value">
        {display}
        {value != null && <span className="power-unit">{unit}</span>}
      </div>
      {hint && <div className="power-hint">{hint}</div>}
    </div>
  );
}
