import { Battery, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging } from "lucide-react";

export default function BatteryCard({ percent, powerW, remainingCapacityWh }) {
  const value = percent == null ? 0 : Math.min(100, Math.max(0, percent));

  // Choose battery icon that matches the state of charge
  const isCharging = powerW != null && powerW > 5;
  let BatteryIcon = Battery;
  if (isCharging) {
    BatteryIcon = BatteryCharging;
  } else if (value >= 90) {
    BatteryIcon = BatteryFull;
  } else if (value >= 50) {
    BatteryIcon = BatteryMedium;
  } else if (value >= 10) {
    BatteryIcon = BatteryLow;
  }

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const color = "#3ec46d";

  const absW = powerW != null ? Math.round(Math.abs(powerW)) : null;
  const hint =
    powerW == null
      ? null
      : powerW > 5
        ? `lädt · ${absW} W`
        : powerW < -5
          ? `entlädt · ${absW} W`
          : "im Ruhezustand";

  const capacityText =
    remainingCapacityWh != null ? `${Math.round(remainingCapacityWh)} Wh` : null;

  return (
    <div className="card battery-card tone-battery">
      <h3>
        <BatteryIcon size={20} className="card-icon" />
        Batterie
      </h3>
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
        <text x="70" y="62" className="gauge-text" dominantBaseline="central">
          {percent == null ? "–" : `${Math.round(value)}%`}
        </text>
        {capacityText && (
          <text
            x="70"
            y="86"
            className="gauge-power"
            dominantBaseline="central"
            textAnchor="middle"
          >
            {capacityText}
          </text>
        )}
      </svg>
      {hint && <div className="power-hint">{hint}</div>}
    </div>
  );
}
