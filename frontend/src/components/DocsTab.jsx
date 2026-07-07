import { BookOpen, Sun, Wifi, Plug, Settings, CheckCircle2, AlertTriangle } from "lucide-react";

export default function DocsTab() {
  return (
    <div className="docs">
      <div className="docs-header">
        <BookOpen size={24} className="docs-icon" />
        <h2>Einrichtungsanleitung</h2>
      </div>

      <section className="docs-section">
        <h3>
          <Sun size={18} className="inline-icon" />
          Schritt 1: API auf der sonnenBatterie freischalten
        </h3>

        <div className="docs-step">
          <p>
            Öffne das Web-Interface deiner sonnenBatterie im Browser. Gehe auf die
            IP-Adresse, die du später im Konfigurations-Tab einträgst (z. B. <code>http://192.168.1.50</code>).
          </p>

          <ol>
            <li>
              <strong>Menü → Softwareintegration</strong> (oder „API") öffnen
            </li>
            <li>
              <strong>API-Zugriff aktivieren</strong> – Schalter auf „an" stellen
            </li>
            <li>
              <strong>Read-Token generieren</strong> – Klicke auf „Token erstellen" und
              kopiere den angezeigten Wert (ca. 40 Zeichen, z. B. <code>abc123def456...</code>)
            </li>
            <li>
              <strong>Token notieren</strong> – Du brauchst ihn im nächsten Schritt
            </li>
          </ol>

          <div className="docs-tip">
            <CheckCircle2 size={16} className="inline-icon" />
            <strong>Test:</strong> Öffne einen neuen Browser-Tab und prüfe:
            <code>http://&lt;IP&gt;/api/v2/status</code> – Du solltest JSON-Daten
            sehen (Production_W, Consumption_W, USOC …).
          </div>
        </div>
      </section>

      <section className="docs-section">
        <h3>
          <Wifi size={18} className="inline-icon" />
          Schritt 2: Netzwerk prüfen
        </h3>

        <div className="docs-step">
          <p>
            Stelle sicher, dass <strong>sonnenBatterie</strong> und <strong>HCU</strong>
            (oder dein Entwicklungs-Rechner) im selben lokalen Netzwerk sind.
          </p>

          <ul>
            <li>Selbe Subnet (z. B. beide im 192.168.1.x-Bereich)</li>
            <li>Kein Firewall, der Port 80 blockiert</li>
            <li>IP-Adresse der Batterie ist von der HCU aus pingbar</li>
          </ul>
        </div>
      </section>

      <section className="docs-section">
        <h3>
          <Plug size={18} className="inline-icon" />
          Schritt 3: Plugin konfigurieren
        </h3>

        <div className="docs-step">
          <p>Wechsle zum <strong>Konfiguration</strong>-Tab und fülle aus:</p>

          <table className="docs-table">
            <thead>
              <tr>
                <th>Feld</th>
                <th>Was eintragen</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>IP-Adresse</td>
                <td>Lokale IP der sonnenBatterie (z. B. <code>192.168.1.50</code>)</td>
              </tr>
              <tr>
                <td>API-Version</td>
                <td>
                  <strong>V2</strong> (Standard, Port 80) oder <strong>V1</strong> (Legacy, Port 8080, kein Token)
                </td>
              </tr>
              <tr>
                <td>API Read-Token</td>
                <td>Den Token aus Schritt 1 (nur bei V2 nötig)</td>
              </tr>
              <tr>
                <td>Port</td>
                <td>Leer lassen (Standard: 80 für V2, 8080 für V1)</td>
              </tr>
              <tr>
                <td>Abfrageintervall</td>
                <td>30 Sekunden (Standard, min. 5 s)</td>
              </tr>
              <tr>
                <td>Kapazität</td>
                <td>Leer lassen → wird automatisch berechnet</td>
              </tr>
            </tbody>
          </table>

          <p>
            Klicke auf <strong>Konfiguration speichern</strong>. Bei Erfolg erscheint
            eine grüne Bestätigungsmeldung.
          </p>

          <div className="docs-warn">
            <AlertTriangle size={16} className="inline-icon" />
            <strong>Hinweis:</strong> Wenn die Meldung „Batterie nicht erreichbar"
            erscheint, prüfe IP-Adresse, Token und Netzwerkverbindung.
          </div>
        </div>
      </section>

      <section className="docs-section">
        <h3>
          <Settings size={18} className="inline-icon" />
          Schritt 4: Geräte in Homematic IP einbinden
        </h3>

        <div className="docs-step">
          <p>
            Nach erfolgreicher Konfiguration (Status „Bereit") musst du die Geräte
            in HCUweb einbinden, bevor Werte angezeigt werden:
          </p>

          <ol>
            <li>
              HCUweb öffnen → <strong>Plugin</strong> → <strong>Geräte entdecken</strong>
              klicken
            </li>
            <li>
              Die 4 Geräte auswählen: <em>sonnenBatterie</em>, <em>sonnen PV-Erzeugung</em>,
              <em> sonnen Netzanschluss</em>, <em>sonnen Hausverbrauch</em>
            </li>
            <li>
              <strong>Einbinden</strong> bestätigen
            </li>
            <li>
              Die Geräte erscheinen nun in der Homematic IP App und können in
              Diagrammen und Automatisierungen genutzt werden
            </li>
          </ol>

          <div className="docs-tip">
            <CheckCircle2 size={16} className="inline-icon" />
            <strong>Wichtig:</strong> Erst nach dem Einbinden werden Live-Daten
            gesendet. Vorher werden die Poll-Ergebnisse nur im Dashboard angezeigt.
          </div>
        </div>
      </section>

      <footer className="docs-footer">
        <p>
          Weitere Details:{" "}
          <a href="https://github.com/ge2301/HCU_Plugin_SonnenBatterie" target="_blank" rel="noopener noreferrer">
            GitHub Repository
          </a>
        </p>
      </footer>
    </div>
  );
}