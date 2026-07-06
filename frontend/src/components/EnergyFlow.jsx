import { useCallback, useMemo } from "react";
import { ReactFlow, Background, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { Zap, Sun, Home, Battery, BatteryCharging, BatteryFull, BatteryMedium, BatteryLow } from "lucide-react";

const nodeTypes = { pv: "pv", haus: "haus", batterie: "batterie", netz: "netz" };

const NODE_POSITIONS = {
  pv: { x: 20, y: 100 },
  batterie: { x: 250, y: 20 },
  netz: { x: 250, y: 180 },
  haus: { x: 480, y: 100 },
};

const nodeStyle = {
  width: 140,
  height: 60,
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
  position: "relative",
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
  <div style={nodeStyle}>
    <Handle type="source" position={Position.Right} style={{ background: "#f0ad4e", width: 8, height: 8 }} />
    <NodeLabel icon={<Sun size={18} color="#f0ad4e" />} label="PV" value={data.productionW} color="#f0ad4e" />
  </div>
);

const HausNode = ({ data }) => (
  <div style={nodeStyle}>
    <Handle type="target" position={Position.Left} style={{ background: "#5aa9e6", width: 8, height: 8 }} />
    <Handle type="source" position={Position.Left} style={{ background: "#b07de0", width: 8, height: 8 }} />
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
    <div style={nodeStyle}>
      <Handle type="target" position={Position.Left} style={{ background: "#f0ad4e", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: "#3ec46d", width: 8, height: 8 }} />
      <NodeLabel icon={<Icon size={18} color={socColor} />} label="Batterie" value={chargeW} color={socColor} />
    </div>
  );
};

const NetzNode = ({ data }) => (
  <div style={nodeStyle}>
    <Handle type="target" position={Position.Right} style={{ background: "#b07de0", width: 8, height: 8 }} />
    <Handle type="source" position={Position.Right} style={{ background: "#5aa9e6", width: 8, height: 8 }} />
    <NodeLabel icon={<Zap size={18} color="#b07de0" />} label="Netz" value={data.gridImportPowerW} color="#b07de0" />
  </div>
);

const customNodeTypes = { [nodeTypes.pv]: PvNode, [nodeTypes.haus]: HausNode, [nodeTypes.batterie]: BatterieNode, [nodeTypes.netz]: NetzNode };

function makeEdge(id, source, target, w, color) {
  const absW = Math.abs(w);
  return {
    id, source, target, animated: absW > 5,
    style: {
      stroke: color,
      strokeWidth: Math.max(1, Math.min(6, absW / 300)),
      opacity: Math.max(0.15, Math.min(1, absW / 400)),
    },
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

    // PV → Haus (direkte Nutzung)
    const pvToHaus = productionW > 5 && consumptionW > 5 ? Math.min(productionW, consumptionW) : 0;
    result.push(makeEdge("e-pv-haus", "pv", "haus", pvToHaus, "#f0ad4e"));

    // PV → Batterie (laden)
    const pvToBat = productionW > 5 && batteryChargePowerW > 5 ? Math.min(productionW, batteryChargePowerW) : 0;
    result.push(makeEdge("e-pv-bat", "pv", "batterie", pvToBat, "#f0ad4e"));

    // Batterie → Haus (entladen)
    const batToHaus = batteryChargePowerW < -5 && consumptionW > 5 ? Math.min(-batteryChargePowerW, consumptionW) : 0;
    result.push(makeEdge("e-bat-haus", "batterie", "haus", batToHaus, "#3ec46d"));

    // Netz → Haus (Bezug)
    const netzToHaus = gridImportPowerW > 5 && consumptionW > 5 ? Math.min(gridImportPowerW, consumptionW) : 0;
    result.push(makeEdge("e-netz-haus", "netz", "haus", netzToHaus, "#5aa9e6"));

    // Haus → Netz (Einspeisung)
    const hausToNetz = gridImportPowerW < -5 ? -gridImportPowerW : 0;
    result.push(makeEdge("e-haus-netz", "haus", "netz", hausToNetz, "#b07de0"));

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
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={2}
          defaultEdgeOptions={{ type: "smoothstep" }}
        >
          <Background color="rgba(255,255,255,0.03)" gap={20} size={1} />
        </ReactFlow>
      </div>
      {edges.length === 0 && <p className="muted-text" style={{ textAlign: "center", marginTop: 8 }}>Keine nennenswerten Energieflüsse.</p>}
    </section>
  );
}
