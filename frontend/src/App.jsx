import { useEffect, useState, useCallback } from "react";
import { LayoutDashboard, Settings } from "lucide-react";
import StatusBar from "./components/StatusBar.jsx";
import SocGauge from "./components/SocGauge.jsx";
import PowerCard from "./components/PowerCard.jsx";
import EnergyFlow from "./components/EnergyFlow.jsx";
import ConfigForm from "./components/ConfigForm.jsx";

const POLL_MS = 5000;

export default function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [tab, setTab] = useState("dashboard"); // "dashboard" | "config"

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("./api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState(data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, POLL_MS);
    return () => clearInterval(id);
  }, [fetchState]);

  // After config save, refresh state immediately
  useEffect(() => {
    if (tab === "dashboard") fetchState();
  }, [tab, fetchState]);

  const plugin = state?.plugin;
  const status = state?.status;
  const config = state?.config;

  return (
    <div className="app">
      <header className="header">
        <img src="./sun.svg" alt="" className="logo" />
        <div>
          <h1>sonnenBatterie</h1>
          <span className="subtitle">Homematic IP Connect Plugin</span>
        </div>
      </header>

      <StatusBar plugin={plugin} error={error} updatedAt={updatedAt} />

      {/* Tab Navigation */}
      <nav className="tabs">
        <button
          className={`tab ${tab === "dashboard" ? "active" : ""}`}
          onClick={() => setTab("dashboard")}
        >
          <LayoutDashboard size={18} className="inline-icon" /> Dashboard
        </button>
        <button
          className={`tab ${tab === "config" ? "active" : ""}`}
          onClick={() => setTab("config")}
        >
          <Settings size={18} className="inline-icon" /> Konfiguration
        </button>
      </nav>

      {tab === "dashboard" ? (
        <>
          {status && status.online !== false ? (
            <>
              <section className="grid">
                <SocGauge percent={status.stateOfChargePercent} />
                <PowerCard
                  title="PV-Erzeugung"
                  value={status.productionW}
                  unit="W"
                  tone="production"
                />
                <PowerCard
                  title="Hausverbrauch"
                  value={status.consumptionW}
                  unit="W"
                  tone="consumption"
                />
                <PowerCard
                  title="Batterie"
                  value={status.batteryChargePowerW}
                  unit="W"
                  tone="battery"
                  hint={batteryHint(status.batteryChargePowerW)}
                />
                <PowerCard
                  title="Netz"
                  value={status.gridImportPowerW}
                  unit="W"
                  tone="grid"
                  hint={gridHint(status.gridImportPowerW)}
                />
              </section>

              <EnergyFlow status={status} />

              <section className="details">
                <h2>Details</h2>
                <dl>
                  <Detail label="Systemstatus" value={status.systemStatus ?? "–"} />
                  <Detail
                    label="Restkapazität"
                    value={status.remainingCapacityWh != null ? `${status.remainingCapacityWh} Wh` : "–"}
                  />
                  <Detail label="USOC" value={fmt(status.usoc, "%")} />
                  <Detail label="RSOC" value={fmt(status.rsoc, "%")} />
                  <Detail label="Letzte Messung" value={status.timestamp ?? "–"} />
                </dl>
              </section>
            </>
          ) : (
            <section className="placeholder">
              <p>
                {plugin && !plugin.configured
                  ? 'Noch nicht konfiguriert. Gehe zum "Konfiguration"-Tab, um IP-Adresse und Token einzutragen.'
                  : "Warte auf Daten der sonnenBatterie …"}
              </p>
              {plugin?.lastError && <p className="err-detail">Letzter Fehler: {plugin.lastError}</p>}
            </section>
          )}
        </>
      ) : (
        <ConfigForm initialConfig={config} onSave={fetchState} />
      )}
    </div>
  );
}

function batteryHint(w) {
  if (w == null) return null;
  if (w > 5) return "lädt";
  if (w < -5) return "entlädt";
  return "im Ruhezustand";
}

function gridHint(w) {
  if (w == null) return null;
  if (w > 5) return "Bezug aus dem Netz";
  if (w < -5) return "Einspeisung ins Netz";
  return "neutral";
}

function fmt(v, unit) {
  return v == null ? "–" : `${v} ${unit}`;
}

function Detail({ label, value }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
