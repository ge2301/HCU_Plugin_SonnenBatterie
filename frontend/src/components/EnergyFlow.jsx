import { Zap } from "lucide-react";

/**
 * Live energy flow visualization showing PV → consumption, PV → battery,
 * battery → consumption, grid → consumption, and grid export flows.
 * Arrow thickness scales with power magnitude.
 */
export default function EnergyFlow({ status }) {
  const { productionW, consumptionW, gridImportPowerW, batteryChargePowerW } = status;

  // Flow arrows with power values
  const flows = [];

  // PV → Consumption (direct use)
  if (productionW > 5 && consumptionW > 5) {
    const direct = Math.min(productionW, consumptionW);
    if (direct > 5) flows.push({ label: "PV → Haus", w: direct, color: "var(--production)" });
  }

  // PV → Battery (charging from PV)
  if (productionW > 5 && batteryChargePowerW > 5) {
    const pvToBat = Math.min(productionW, batteryChargePowerW);
    if (pvToBat > 5) flows.push({ label: "PV → Batterie", w: pvToBat, color: "var(--production)" });
  }

  // Battery → Consumption
  if (batteryChargePowerW < -5 && consumptionW > 5) {
    const batToCon = Math.min(-batteryChargePowerW, consumptionW);
    if (batToCon > 5) flows.push({ label: "Batterie → Haus", w: batToCon, color: "var(--battery)" });
  }

  // Grid → Consumption (import)
  if (gridImportPowerW > 5 && consumptionW > 5) {
    const gridToCon = Math.min(gridImportPowerW, consumptionW);
    if (gridToCon > 5) flows.push({ label: "Netz → Haus", w: gridToCon, color: "var(--consumption)" });
  }

  // Grid export (feeding in)
  if (gridImportPowerW < -5) {
    flows.push({ label: "Haus → Netz", w: -gridImportPowerW, color: "var(--grid)" });
  }

  return (
    <section className="flow">
      <h2>
        <Zap size={20} className="card-icon" />
        Energiefluss
      </h2>
      {flows.length > 0 ? (
        <div className="flow-svg-container">
          <svg viewBox="0 0 800 200" className="flow-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.5)" />
              </marker>
            </defs>

            {/* Nodes */}
            <rect x="10" y="70" width="100" height="60" rx="10" fill="var(--production)" opacity="0.15" />
            <text x="60" y="105" textAnchor="middle" fill="var(--production)" fontSize="13" fontWeight="600">PV</text>

            <rect x="350" y="70" width="100" height="60" rx="10" fill="var(--consumption)" opacity="0.15" />
            <text x="400" y="105" textAnchor="middle" fill="var(--consumption)" fontSize="13" fontWeight="600">Haus</text>

            <rect x="600" y="70" width="100" height="60" rx="10" fill="var(--grid)" opacity="0.15" />
            <text x="650" y="105" textAnchor="middle" fill="var(--grid)" fontSize="13" fontWeight="600">Netz</text>

            <rect x="350" y="10" width="100" height="45" rx="10" fill="var(--battery)" opacity="0.15" />
            <text x="400" y="38" textAnchor="middle" fill="var(--battery)" fontSize="13" fontWeight="600">Batterie</text>

            {/* Flow arrows */}
            {flows.map((flow, i) => {
              const thickness = Math.max(2, Math.min(12, flow.w / 200));
              const opacity = Math.max(0.2, Math.min(1, flow.w / 800));
              const y = 100 + (i - (flows.length - 1) / 2) * 18;
              return (
                <g key={i}>
                  <line
                    x1="120"
                    y1={y}
                    x2="580"
                    y2={y}
                    stroke={flow.color}
                    strokeWidth={thickness}
                    opacity={opacity}
                    markerEnd="url(#arrowhead)"
                  />
                  <text
                    x="350"
                    y={y - 8}
                    textAnchor="middle"
                    fill="var(--text)"
                    fontSize="11"
                    fontWeight="500"
                  >
                    {flow.label} · {Math.round(flow.w)} W
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="muted-text">Keine nennenswerten Energieflüsse.</p>
      )}
    </section>
  );
}
