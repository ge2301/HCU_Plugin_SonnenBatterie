import { useState, useCallback, useEffect } from "react";

export default function ConfigForm({ initialConfig, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);

  // Sync when initialConfig changes (after save response)
  useEffect(() => {
    if (initialConfig) setForm(initialConfig);
  }, [initialConfig]);

  const set = (key) => (e) => {
    const raw = e.target.value;
    const bool = typeof form[key] === "boolean";
    const num = ["sonnenPort", "pollIntervalSeconds", "batteryCapacityWh"].includes(key);
    setForm((f) => ({
      ...f,
      [key]: bool ? e.target.checked : num ? (raw === "" ? null : Number(raw)) : raw,
    }));
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setSaving(true);
      setSaved(null);
      setError(null);

      // Validate
      if (!form.sonnenHost?.trim()) {
        setError("IP-Adresse ist erforderlich.");
        setSaving(false);
        return;
      }
      if ((form.sonnenApiVersion || "V2") === "V2" && !form.sonnenToken?.trim()) {
        setError("API Read-Token ist bei Version V2 erforderlich.");
        setSaving(false);
        return;
      }
      if (form.sonnenPort != null && (form.sonnenPort < 1 || form.sonnenPort > 65535)) {
        setError("Port muss zwischen 1 und 65535 liegen.");
        setSaving(false);
        return;
      }
      if (form.pollIntervalSeconds != null && form.pollIntervalSeconds < 5) {
        setError("Abfrageintervall muss mindestens 5 Sekunden betragen.");
        setSaving(false);
        return;
      }

      try {
        const res = await fetch("./api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setSaved(data.message || "Gespeichert!");
      } catch (err) {
        setError(`Speichern fehlgeschlagen: ${err.message}`);
      } finally {
        setSaving(false);
      }
    },
    [form]
  );

  if (!form || Object.keys(form).length === 0) {
    return <div className="placeholder">Lade Konfiguration …</div>;
  }

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      <section className="config-section">
        <h3>🔌 Verbindung</h3>

        <label className="form-field">
          <span>IP-Adresse der sonnenBatterie <span className="req">*</span></span>
          <input
            type="text"
            value={form.sonnenHost || ""}
            onChange={set("sonnenHost")}
            placeholder="z. B. 192.168.1.50"
            required
          />
          <small>Lokale IP-Adresse deiner sonnenBatterie</small>
        </label>

        <label className="form-field">
          <span>API-Version</span>
          <select value={form.sonnenApiVersion || "V2"} onChange={set("sonnenApiVersion")}>
            <option value="V2">V2 (Standard, Port 80, Token nötig)</option>
            <option value="V1">V1 (Legacy, Port 8080, kein Token)</option>
          </select>
          <small>V2 ist der aktuelle Standard. V1 für ältere Geräte.</small>
        </label>

        {(form.sonnenApiVersion || "V2") === "V2" && (
          <label className="form-field">
            <span>API Read-Token <span className="req">*</span></span>
            <input
              type="password"
              value={form.sonnenToken || ""}
              onChange={set("sonnenToken")}
              placeholder="Im sonnen Web-Interface generieren"
              required
            />
            <small>
              Unter{" "}
              <code>http://{form.sonnenHost || "…"}/api/v2/status</code>{" "}
              → Softwareintegration → Read-Token
            </small>
          </label>
        )}

        <label className="form-field">
          <span>Port (optional)</span>
          <input
            type="number"
            value={form.sonnenPort != null ? form.sonnenPort : ""}
            onChange={set("sonnenPort")}
            placeholder="80 (V2) / 8080 (V1)"
            min={1}
            max={65535}
          />
          <small>Nur ändern, wenn ein abweichender Port nötig ist.</small>
        </label>

        <label className="form-field">
          <span>Abfrageintervall (Sekunden)</span>
          <input
            type="number"
            value={form.pollIntervalSeconds || 30}
            onChange={set("pollIntervalSeconds")}
            min={5}
            max={3600}
          />
          <small>Wie oft die Batterie abgefragt wird. Minimum 5 s.</small>
        </label>
      </section>

      <section className="config-section">
        <h3>🔋 Batterie</h3>

        <label className="form-field">
          <span>Nutzbare Kapazität (Wh, optional)</span>
          <input
            type="number"
            value={form.batteryCapacityWh != null ? form.batteryCapacityWh : ""}
            onChange={set("batteryCapacityWh")}
            placeholder="Wird automatisch geschätzt"
            min={0}
          />
          <small>Optional. Sonst wird der Wert aus Restkapazität / SOC berechnet.</small>
        </label>
      </section>

      <section className="config-section">
        <h3>📡 Geräte melden</h3>

        <label className="form-field checkbox-field">
          <input type="checkbox" checked={form.exposeBattery !== false} onChange={set("exposeBattery")} />
          <span>Batterie (Ladezustand + Leistung)</span>
        </label>
        <label className="form-field checkbox-field">
          <input type="checkbox" checked={form.exposeInverter !== false} onChange={set("exposeInverter")} />
          <span>PV-Erzeugung</span>
        </label>
        <label className="form-field checkbox-field">
          <input type="checkbox" checked={form.exposeGrid !== false} onChange={set("exposeGrid")} />
          <span>Netzanschluss (Bezug/Einspeisung)</span>
        </label>
        <label className="form-field checkbox-field">
          <input type="checkbox" checked={form.exposeConsumption !== false} onChange={set("exposeConsumption")} />
          <span>Hausverbrauch</span>
        </label>
      </section>

      {error && <div className="config-feedback err">{error}</div>}
      {saved && <div className="config-feedback ok">{saved}</div>}

      <button type="submit" className="btn-save" disabled={saving}>
        {saving ? "Speichere …" : "💾 Konfiguration speichern"}
      </button>
    </form>
  );
}