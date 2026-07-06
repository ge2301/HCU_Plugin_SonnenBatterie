export default function StatusBar({ plugin, error, updatedAt }) {
  const readiness = plugin?.readiness ?? "UNKNOWN";
  const connected = plugin?.connectedToHcu;

  const readinessLabel = {
    READY: "Bereit",
    CONFIG_REQUIRED: "Konfiguration erforderlich",
    ERROR: "Fehler",
    UNKNOWN: "Verbinde …",
  }[readiness];

  const readinessClass = {
    READY: "ok",
    CONFIG_REQUIRED: "warn",
    ERROR: "err",
    UNKNOWN: "muted",
  }[readiness];

  return (
    <div className="statusbar">
      <span className={`badge ${readinessClass}`}>{readinessLabel}</span>
      <span className={`badge ${connected ? "ok" : "muted"}`}>
        HCU {connected ? "verbunden" : "getrennt"}
      </span>
      {error && <span className="badge err">Dashboard: {error}</span>}
      {updatedAt && (
        <span className="badge muted">
          Aktualisiert {updatedAt.toLocaleTimeString("de-DE")}
        </span>
      )}
    </div>
  );
}
