import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { ReactFlow, Background, Handle, Position, StepEdge } from "reactflow";
import "reactflow/dist/style.css";
import { Zap, Sun, Home, Battery, BatteryCharging, BatteryFull, BatteryMedium, BatteryLow } from "lucide-react";

const nodeTypes = { pv: "pv", haus: "haus", batterie: "batterie", netz: "netz" };
const edgeTypes = { step: StepEdge };

const NODE_POSITIONS = {
  pv: { x: 20, y: 120 },
  batterie: { x: 260, y: 20 },
  netz: { x: 260, y: 260 },
  haus: { x: 520, y: 120 },
};

const nodeStyle = {
  width: 220,
  height: 100,
  borderRadius: 14,
  padding: "10px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  fontSize: 15,
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

const NodeLabel = ({ icon, label, subLabel, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
    {icon}
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
      {subLabel && <div style={{ fontSize: 11, color: color, marginTop: 1 }}>{subLabel}</div>}
      {value != null && <div style={{ fontSize: 24, fontWeight: 700, color: "#8b9bad", marginTop: 2 }}>{typeof value === "number" ? Math.round(value) + " W" : value}</div>}
    </div>
  </div>
);

const HandleDot = (props) => <Handle {...props} style={{ background: "transparent", width: 0, height: 0, border: "none" }} />;

const PvNode = ({ data }) => (
  <div style={nodeStyle}>
    <HandleDot id="bat" type="source" position={Position.Top} />
    <HandleDot id="haus" type="source" position={Position.Right} />
    <HandleDot id="netz" type="source" position={Position.Bottom} />
    <NodeLabel icon={<Sun size={59} color="#f0ad4e" />} label="PV" subLabel="Erzeugung" value={data.productionW} color="#f0ad4e" />
  </div>
);

const HausNode = ({ data }) => (
  <div style={nodeStyle}>
    <HandleDot id="pv" type="target" position={Position.Left} />
    <HandleDot id="bat" type="target" position={Position.Top} />
    <HandleDot id="netz" type="target" position={Position.Bottom} />
    <NodeLabel icon={<Home size={59} color="#5aa9e6" />} label="Haus" subLabel="Verbrauch" value={data.consumptionW} color="#5aa9e6" />
  </div>
);

const BatterieNode = ({ data }) => {
  const soc = data.stateOfChargePercent;
  const chargeW = data.batteryChargePowerW;
  const isCharging = chargeW > 5;
  const isDischarging = chargeW < -5;
  let Icon = Battery;
  if (isCharging) Icon = BatteryCharging;
  else if (soc >= 90) Icon = BatteryFull;
  else if (soc >= 50) Icon = BatteryMedium;
  else if (soc >= 10) Icon = BatteryLow;
  const socColor = "#3ec46d";
  const statusHint = isCharging
    ? ` · lädt`
    : isDischarging
    ? ` · entlädt`
    : ` · im Ruhezustand`;
  const absW = isCharging ? chargeW : isDischarging ? -chargeW : 0;
  return (
    <div style={nodeStyle}>
      <HandleDot id="pv" type="target" position={Position.Left} />
      <HandleDot id="haus" type="source" position={Position.Right} />
      <NodeLabel
        icon={<Icon size={59} color={socColor} />}
        label="Batterie"
        subLabel={`${Math.round(soc)} %${statusHint}`}
        value={absW}
        color={socColor}
      />
    </div>
  );
};

const NetzNode = ({ data }) => {
  const gridW = data.gridImportPowerW;
  const isImport = gridW > 5;
  const isExport = gridW < -5;
  let subLabel, color;
  if (isExport) {
    subLabel = "Einspeisung";
    color = "#b07de0";
  } else if (isImport) {
    subLabel = "Bezug";
    color = "#b07de0";
  } else {
    subLabel = "Ausgeglichen";
    color = "#8b9bad";
  }
  return (
    <div style={nodeStyle}>
      <HandleDot id="pv" type="target" position={Position.Left} />
      <HandleDot id="haus" type="source" position={Position.Right} />
      <NodeLabel
        icon={<Zap size={59} color="#b07de0" />}
        label="Netz"
        subLabel={subLabel}
        value={Math.abs(gridW)}
        color={color}
      />
    </div>
  );
};

const customNodeTypes = { [nodeTypes.pv]: PvNode, [nodeTypes.haus]: HausNode, [nodeTypes.batterie]: BatterieNode, [nodeTypes.netz]: NetzNode };

function makeEdge(id, source, target, w, color, sourceHandle, targetHandle, type) {
  const absW = Math.abs(w);
  const hasFlow = absW > 5;
  const edge = {
    id, source, target, animated: hasFlow,
    style: {
      stroke: color,
      strokeWidth: 2.5,
      opacity: hasFlow ? 1 : 0,
    },
  };
  if (sourceHandle) edge.sourceHandle = sourceHandle;
  if (targetHandle) edge.targetHandle = targetHandle;
  if (type) edge.type = type;
  return edge;
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

    // PV → Haus (direkte Nutzung, gerade Linie)
    const pvToHaus = productionW > 5 && consumptionW > 5 ? Math.min(productionW, consumptionW) : 0;
    result.push(makeEdge("e-pv-haus", "pv", "haus", pvToHaus, "#f0ad4e", "haus", "pv", "default"));

    // PV → Batterie (laden)
    const pvToBat = productionW > 5 && batteryChargePowerW > 5 ? Math.min(productionW, batteryChargePowerW) : 0;
    result.push(makeEdge("e-pv-bat", "pv", "batterie", pvToBat, "#f0ad4e", "bat", "pv", "step"));

    // Batterie → Haus (entladen, von oben)
    const batToHaus = batteryChargePowerW < -5 && consumptionW > 5 ? Math.min(-batteryChargePowerW, consumptionW) : 0;
    result.push(makeEdge("e-bat-haus", "batterie", "haus", batToHaus, "#3ec46d", "haus", "bat", "step"));

    // Netz → Haus (Bezug, von unten)
    const netzToHaus = gridImportPowerW > 5 && consumptionW > 5 ? Math.min(gridImportPowerW, consumptionW) : 0;
    result.push(makeEdge("e-netz-haus", "netz", "haus", netzToHaus, "#5aa9e6", "haus", "netz", "step"));

    // PV → Netz (Einspeisung)
    const pvToNetz = gridImportPowerW < -5 ? -gridImportPowerW : 0;
    result.push(makeEdge("e-pv-netz", "pv", "netz", pvToNetz, "#b07de0", "netz", "pv", "step"));

    return result;
  }, [productionW, consumptionW, gridImportPowerW, batteryChargePowerW]);

  const onNodesChange = useCallback(() => {}, []);
  const onEdgesChange = useCallback(() => {}, []);

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  useEffect(() => {
    if (!reactFlowInstance || !reactFlowWrapper.current) return;
    const observer = new ResizeObserver(() => {
      reactFlowInstance.fitView({ padding: 0.15 });
    });
    observer.observe(reactFlowWrapper.current);
    return () => observer.disconnect();
  }, [reactFlowInstance]);

  return (
    <section className="flow">
      <h2>
        <Zap size={20} className="card-icon" />
        Energiefluss
      </h2>
      <div ref={reactFlowWrapper} className="reactflow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={customNodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={(instance) => {
            setReactFlowInstance(instance);
            instance.fitView({ padding: 0.15 });
          }}
          fitViewOptions={{ padding: 0.15 }}
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
