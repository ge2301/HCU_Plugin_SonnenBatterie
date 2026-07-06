export default function SocGauge({ percent }) {
  const value = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  const color = value > 50 ? "#3ec46d" : value > 20 ? "#f5a623" : "#e0533d";

  return (
    <div className="card gauge-card">
      <h3>Ladezustand</h3>
      <svg viewBox="0 0 140 140" className="gauge">
        <circle cx="70" cy="70" r={radius} className="gauge-track" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          className="gauge-value"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="70" className="gauge-text" dominantBaseline="central">
          {percent == null ? "–" : `${Math.round(value)}%`}
        </text>
      </svg>
    </div>
  );
}
