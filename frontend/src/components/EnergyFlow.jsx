import { useCallback, useMemo } from "react";
import { ReactFlow, Background, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import { Zap, Sun, Home, Battery, BatteryCharging, BatteryFull, BatteryMedium, BatteryLow } from "lucide-react";

const nodeTypes = { pv: "pv", haus: "haus", batterie: "batterie", netz: "netz" };

const NODE_POSITIONS = {
  pv: { x: 40, y: 80 },
  batterie: { x: 260, y: 10 },
  haus: { x: 260, y: 80 },
  netz: { x: 480, y: 80 },
};

const nodeStyle = {
  width: 130,
  height: 56,
  borderRadius: 12,
  padding: "8px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid rgba(255,255,255,0.08)",
  fontFamily: "inherit",
  color: "#e6edf3",
  background: "rgba(23,33,43,0.95)",
  backdropFilter: "blur(4px)",
  cursor: "grab",
  userSelect: "none",
};

const NodeLabel = ({ icon, label, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
    {icon}
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
      {value != null && <div style={{ fontSize: 11, color: "#8b9bad", marginTop: 1 }}>{Math.round(value)} W</div>}
    </div>
  </div>
);

const PvNode = ({ data }) => (
  <div style={{ ...nodeStyle, borderColor: "rgba(240,173,78,0.3)" }}>
    <NodeLabel icon={<Sun size={18} color="#f0ad4e" />} label="PV" value={data.productionW} color="#f0ad4e" />
  </div>
);

const HausNode = ({ data }) => (
  <div style={{ ...nodeStyle, borderColor: "rgba(90,169,230,0.3)" }}>
    <NodeLabel icon={<Home size={18} color="#5aa9e6" />} label="Haus" value={data.consumptionW} color="#5aa9e6" />
  </div>
);

const BatterieNode = ({ data }) => {
  const soc = data.stateOfChargePercent;
  const chargeW = data.batteryChargePowerW;
  const isCharging = chargeW > 5;
  let Icon = Battery;
  if (isCharging) Icon = BatteryCharging;
  else if (soc >= 90) Icon = BatteryFull;
  else if (soc >= 50) Icon = BatteryMedium;
  else if (soc >= 10) Icon = BatteryLow;
  const socColor = soc > 50 ? "#3ec46d" : soc > 20 ? "#f0ad4e" : "#e0533d";
  return (
    <div style={{ ...nodeStyle, borderColor: "rgba(62,196,109,0.3)" }}>
      <NodeLabel icon={<Icon size={18} color={socColor} />} label="Batterie" value={chargeW} color={socColor} />
    </div>
  );
};

const NetzNode = ({ data }) => (
  <div style={{ ...nodeStyle, borderColor: "rgba(176,125,224,0.3)" }}>
    <NodeLabel icon={<Zap size={18} color="#b07de0" />} label="Netz" value={data.gridImportPowerW} color="#b07de0" />
  </div>
);

const customNodeTypes = { [nodeTypes.pv]: PvNode, [nodeTypes.haus]: HausNode, [nodeTypes.batterie]: BatterieNode, [nodeTypes.netz]: NetzNode };

function makeEdge(id, source, target, w, color) {
  return {
    id, source, target, animated: true,
    style: { stroke: color, strokeWidth: Math.max(2, Math.min(6, w / 300)), opacity: Math.max(0.3, Math.min(1, w / 600)) },
    label: `${Math.round(w)} W`,
    labelStyle: { fill: "#e6edf3", fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: "rgba(15,23,32,0.85)", fillOpacity: 1 },
    labelBgPadding: [4, 6],
    labelBgBorderRadius: 4,
    labelBgBlur: 4,
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 8 },
  };
}

export default function EnergyFlow({ status }) {
  const { productionW, consumptionW, gridImportPowerW, batteryChargePowerW, stateOfChargePercent } = status;

  const nodes = useMemo(
    () => [
      { id: "pv", type: nodeTypes.pv, position: NODE_POSITIONS.pv, data: { productionW }, draggable: false, selectable: false },
      { id: "batterie", type: nodeTypes.batterie, position: NODE_POSITIONS.batterie, data: { stateOfChargePercent, batteryChargePowerW }, draggable: false, selectable: false },
      { id: "haus", type: nodeTypes.haus, position: NODE_POSITIONS.haus, data: { consumptionW }, draggable: false, selectable: false },
      { id: "netz", type: nodeTypes.netz, position: NODE_POSITIONS.netz, data: { gridImportPowerW }, draggable: false, selectable: false },
    ],
    [productionW, consumptionW, gridImportPowerW, batteryChargePowerW, stateOfChargePercent]
  );

  const edges = useMemo(() => {
    const result = [];

    if (productionW > 5 && consumptionW > 5) {
      const w = Math.min(productionW, consumptionW);
      if (w > 5) result.push(makeEdge("e-pv-haus", "pv", "haus", w, "#f0ad4e"));
    }
    if (productionW > 5 && batteryChargePowerW > 5) {
      const w = Math.min(productionW, batteryChargePowerW);
      if (w > 5) result.push(makeEdge("e-pv-bat", "pv", "batterie", w, "#f0ad4e"));
    }
    if (batteryChargePowerW < -5 && consumptionW > 5) {
      const w = Math.min(-batteryChargePowerW, consumptionW);
      if (w > 5) result.push(makeEdge("e-bat-haus", "batterie", "haus", w, "#3ec46d"));
    }
    if (gridImportPowerW > 5 && consumptionW > 5) {
      const w = Math.min(gridImportPowerW, consumptionW);
      if (w > 5) result.push(makeEdge("e-netz-haus", "netz", "haus", w, "#5aa9e6"));
    }
    if (gridImportPowerW < -5) {
      result.push(makeEdge("e-haus-netz", "haus", "netz", -gridImportPowerW, "#b07de0"));
    }

    return result;
  }, [productionW, consumptionW, gridImportPowerW, batteryChargePowerW]);

  const onNodesChange = useCallback(() => {}, []);
  const onEdgesChange = useCallback(() => {}, []);

  return (
    <section className="flow">
      <h2>
        <Zap size={20} className="card-icon" />
        Energiefluss
      </h2>
      <div className="reactflow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={customNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={2}
        >
          <Background color="rgba(255,255,255,0.03)" gap={20} size={1} />
        </ReactFlow>
      </div>
      {edges.length === 0 && <p className="muted-text" style={{ textAlign: "center", marginTop: 8 }}>Keine nennenswerten Energieflüsse.</p>}
    </section>
  );
}
