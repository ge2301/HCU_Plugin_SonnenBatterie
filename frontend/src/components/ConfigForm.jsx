import { useState, useCallback, useRef } from "react";
import { Plug, Battery, Radio, Save, CheckCircle, AlertCircle } from "lucide-react";

const DEFAULT_FORM = {
  sonnenHost: "",
  sonnenApiVersion: "V2",
  sonnenToken: "",
  sonnenPort: null,
  pollIntervalSeconds: 30,
  batteryCapacityWh: null,
  exposeBattery: true,
  exposeInverter: true,
  exposeGrid: true,
  exposeConsumption: true,
};

export default function ConfigForm({ initialConfig, onSave }) {
  const initRef = useRef(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);

  // Initialise from server once on mount if available.
  // After a successful save the parent refetches state, but we deliberately
  // ignore those updates so the user's typed values stay intact.
  if (!initRef.current) {
    initRef.current = true;
    if (initialConfig && Object.keys(initialConfig).length > 0) {
      setForm({ ...DEFAULT_FORM, ...initialConfig });
    }
  }

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

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      <section className="config-section">
        <h3><Plug size={18} className="inline-icon" /> Verbindung</h3>

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

        <div className="form-row">
          <label className="form-field">
            <span>API-Version</span>
            <select value={form.sonnenApiVersion || "V2"} onChange={set("sonnenApiVersion")}>
              <option value="V2">V2 (Standard, Port 80)</option>
              <option value="V1">V1 (Legacy, Port 8080)</option>
            </select>
            <small>V2 ist der aktuelle Standard.</small>
          </label>

          <label className="form-field">
            <span>Port (optional)</span>
            <input
              type="number"
              value={form.sonnenPort != null ? form.sonnenPort : ""}
              onChange={set("sonnenPort")}
              placeholder="80 / 8080"
              min={1}
              max={65535}
            />
            <small>Nur bei abweichendem Port.</small>
          </label>
        </div>

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
        <h3><Battery size={18} className="inline-icon" /> Batterie</h3>

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
        <h3><Radio size={18} className="inline-icon" /> Geräte melden</h3>

        <div className="form-row form-row-2">
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
        </div>
      </section>

      {error && <div className="config-feedback err"><AlertCircle size={16} className="inline-icon" /> {error}</div>}
      {saved && <div className="config-feedback ok"><CheckCircle size={16} className="inline-icon" /> {saved}</div>}

      <button type="submit" className="btn-save" disabled={saving}>
        {saving ? "Speichere …" : <><Save size={18} className="inline-icon" /> Konfiguration speichern</>}
      </button>
    </form>
  );
}