import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { ReactFlow, Background, Handle, Position, StepEdge } from "reactflow";
import "reactflow/dist/style.css";
import { Zap, Sun, Home, Battery, BatteryCharging, BatteryFull, BatteryMedium, BatteryLow } from "lucide-react";

const nodeTypes = { pv: "pv", haus: "haus", batterie: "batterie", netz: "netz" };
const edgeTypes = { step: StepEdge };

const NODE_POSITIONS = {
  pv: { x: 20, y: 100 },
  batterie: { x: 250, y: 20 },
  netz: { x: 250, y: 180 },
  haus: { x: 480, y: 100 },
};

const nodeStyle = {
  width: 180,
  height: 80,
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

const NodeLabel = ({ icon, label, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
    {icon}
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
      {value != null && <div style={{ fontSize: 11, color: "#8b9bad", marginTop: 1 }}>{Math.round(value)} W</div>}
    </div>
  </div>
);

const HandleDot = (props) => <Handle {...props} style={{ background: "transparent", width: 0, height: 0, border: "none" }} />;

const PvNode = ({ data }) => (
  <div style={nodeStyle}>
    <HandleDot id="bat" type="source" position={Position.Top} />
    <HandleDot id="haus" type="source" position={Position.Right} />
    <HandleDot id="netz" type="source" position={Position.Bottom} />
    <NodeLabel icon={<Sun size={36} color="#f0ad4e" />} label="PV" value={data.productionW} color="#f0ad4e" />
  </div>
);

const HausNode = ({ data }) => (
  <div style={nodeStyle}>
    <HandleDot id="pv" type="target" position={Position.Left} />
    <HandleDot id="bat" type="target" position={Position.Top} />
    <HandleDot id="netz" type="target" position={Position.Bottom} />
    <NodeLabel icon={<Home size={36} color="#5aa9e6" />} label="Haus" value={data.consumptionW} color="#5aa9e6" />
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
      <HandleDot id="pv" type="target" position={Position.Left} />
      <HandleDot id="haus" type="source" position={Position.Right} />
      <NodeLabel icon={<Icon size={36} color={socColor} />} label="Batterie" value={chargeW} color={socColor} />
    </div>
  );
};

const NetzNode = ({ data }) => (
  <div style={nodeStyle}>
    <HandleDot id="pv" type="target" position={Position.Left} />
    <HandleDot id="haus" type="source" position={Position.Right} />
    <NodeLabel icon={<Zap size={36} color="#b07de0" />} label="Netz" value={data.gridImportPowerW} color="#b07de0" />
  </div>
);

const customNodeTypes = { [nodeTypes.pv]: PvNode, [nodeTypes.haus]: HausNode, [nodeTypes.batterie]: BatterieNode, [nodeTypes.netz]: NetzNode };

function makeEdge(id, source, target, w, color, sourceHandle, targetHandle, type) {
  const absW = Math.abs(w);
  const edge = {
    id, source, target, animated: absW > 5,
    style: {
      stroke: color,
      strokeWidth: Math.max(1, Math.min(6, absW / 300)),
      opacity: Math.max(0.15, Math.min(1, absW / 400)),
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
      reactFlowInstance.fitView({ padding: 0.3 });
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
            instance.fitView({ padding: 0.3 });
          }}
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
