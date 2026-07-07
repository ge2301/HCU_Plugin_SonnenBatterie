import { useEffect, useState, useCallback } from "react";
import { LayoutDashboard, Settings, BookOpen, Sun, Home, Zap } from "lucide-react";
import StatusBar from "./components/StatusBar.jsx";
import BatteryCard from "./components/SocGauge.jsx";
import PowerCard from "./components/PowerCard.jsx";
import EnergyFlow from "./components/EnergyFlow.jsx";
import ConfigForm from "./components/ConfigForm.jsx";
import DocsTab from "./components/DocsTab.jsx";

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
    } catch {
      // Backend nicht erreichbar — kein Crash, nur Status-Meldung
      setError("Backend nicht erreichbar. Starte zuerst: node src/index.js");
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
        <img src="./sonnen-logo.svg" alt="sonnen" className="logo" />
        <div className="header-text">
          <h1>sonnenBatterie</h1>
          <span className="subtitle">HomeMatic Control Unit Plugin</span>
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
        <button
          className={`tab ${tab === "docs" ? "active" : ""}`}
          onClick={() => setTab("docs")}
        >
          <BookOpen size={18} className="inline-icon" /> Dokumentation
        </button>
      </nav>

      {tab === "dashboard" ? (
        <>
          {status && status.online !== false ? (
            <>
              <section className="grid">
                <BatteryCard
                  percent={status.stateOfChargePercent}
                  powerW={status.batteryChargePowerW}
                  remainingCapacityWh={status.remainingCapacityWh}
                />
                <PowerCard
                  title="PV"
                  value={status.productionW}
                  unit="W"
                  tone="production"
                  icon={Sun}
                  hint="Erzeugung"
                />
                <PowerCard
                  title="Haus"
                  value={status.consumptionW}
                  unit="W"
                  tone="consumption"
                  icon={Home}
                  hint="Verbrauch"
                />
                <PowerCard
                  title="Netz"
                  value={status.gridImportPowerW}
                  unit="W"
                  tone="grid"
                  icon={Zap}
                  hint={gridHint(status.gridImportPowerW)}
                />
              </section>

              <EnergyFlow status={status} />
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
      ) : tab === "config" ? (
        <ConfigForm initialConfig={config} onSave={fetchState} />
      ) : (
        <DocsTab />
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
