export default function StatusBar({ plugin, error, updatedAt }) {
  const readiness = plugin?.readiness ?? "UNKNOWN";
  const connected = plugin?.connectedToHcu;

  const batteryLabel = {
    READY: "Batterie: Erreichbar",
    CONFIG_REQUIRED: "Batterie: Konfiguration fehlt",
    ERROR: "Batterie: Nicht erreichbar",
    UNKNOWN: "Batterie: Prüfe …",
  }[readiness];

  const readinessClass = {
    READY: "ok",
    CONFIG_REQUIRED: "warn",
    ERROR: "err",
    UNKNOWN: "muted",
  }[readiness];

  return (
    <div className="statusbar">
      <span className={`badge ${readinessClass}`}>{batteryLabel}</span>
      <span className={`badge ${connected ? "ok" : "muted"}`}>
        HCU: {connected ? "Verbunden" : "Getrennt"}
      </span>
      {error && <span className="badge err">{error}</span>}
      {updatedAt && (
        <span className="badge muted">
          Aktualisiert {updatedAt.toLocaleTimeString("de-DE")}
        </span>
      )}
    </div>
  );
}
