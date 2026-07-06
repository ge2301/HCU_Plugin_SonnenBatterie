# sonnenBatterie · Homematic IP HCU Plugin

Ein Node.js-Plugin für die **Homematic IP Home Control Unit (HCU)**, das eine
**sonnenBatterie** (Sonnen GmbH) über deren lokale REST-API ausliest und die
Messwerte über die **Connect API** (WebSocket) als Geräte in das Homematic IP
Netzwerk einbindet. Ein optionales **React-/Vite-Dashboard** zeigt die Live-Daten
im Browser an.

Gemeldete Werte:

| Homematic IP Gerät | Gerätetyp (Connect API) | Werte |
| --- | --- | --- |
| sonnenBatterie | `BATTERY` | Ladezustand (SOC), Lade-/Entladeleistung |
| Sonnen PV-Erzeugung | `INVERTER` | aktuelle PV-Leistung |
| Sonnen Netzanschluss | `GRID_CONNECTION_POINT` | Netzbezug/-einspeisung |
| Sonnen Hausverbrauch | `ENERGY_METER` | aktueller Hausverbrauch |

---

## 1. Voraussetzungen

- sonnenBatterie und HCU im **selben lokalen Netzwerk**.
- **Read-Token** der sonnenBatterie (für API V2). Ältere Geräte nutzen API V1
  (Port 8080, ohne Token).
- **Docker** mit `buildx` (für das `linux/arm64`-Image der HCU).
- **Entwicklermodus** in der HCU aktiviert (WebUI → Einstellungen → System).
  Erst dadurch wird die WebSocket-Schnittstelle der Connect API freigeschaltet
  und der Upload eigener Plugins möglich.

---

## 2. Read-Token auf der sonnenBatterie erzeugen

1. Web-Interface der sonnenBatterie öffnen (`http://<IP-der-Batterie>`).
2. Unter **Softwareintegration / API** einen **Read-Token** generieren.
3. Token notieren – er wird später in der Plugin-Konfiguration eingetragen.

Test (optional) von einem Rechner im selben Netz:

```bash
curl -H "Auth-Token: <DEIN_TOKEN>" http://<IP-der-Batterie>/api/v2/status
```

Die Antwort enthält u. a. `Production_W`, `Consumption_W`, `GridFeedIn_W`,
`Pac_total_W`, `USOC` und `RSOC`.

---

## 3. Plugin bauen

Im Projektverzeichnis (`HCU_Sonnen`):

**Windows (PowerShell):**

```powershell
./build.ps1                 # Version 1.0.0
./build.ps1 -Version 1.1.0  # eigene Version
```

**Linux/macOS (WSL):**

```bash
./build.sh                  # Version 1.0.0
./build.sh 1.1.0            # eigene Version
```

Das Skript baut das Frontend, erstellt das ARM64-Container-Image und exportiert
`de.community.homematic.plugin.sonnen-<version>.tar.gz`.

---

## 4. Plugin auf der HCU installieren

1. HCUweb öffnen → **Plugins** → **Plugin hinzufügen / hochladen**.
2. Die erzeugte Datei `de.community.homematic.plugin.sonnen-<version>.tar.gz`
   hochladen.
3. Nach der Installation erscheint das Plugin mit dem Status
   **„Konfiguration erforderlich"**.

> Der Authorization-Token der HCU wird automatisch bereitgestellt
> (Datei `/TOKEN` im Container). Ein manueller Token-Tausch ist bei der
> Installation über HCUweb **nicht** nötig – nur beim lokalen Entwickeln
> (siehe Abschnitt 7).

---

## 5. Plugin konfigurieren

In HCUweb beim Plugin auf **Konfigurieren** klicken und ausfüllen:

| Feld | Beschreibung |
| --- | --- |
| **IP-Adresse der sonnenBatterie** | z. B. `192.168.1.50` |
| **API-Version** | `V2` (Standard) oder `V1` (Legacy, Port 8080) |
| **API Read-Token** | Token aus Schritt 2 (nur bei V2) |
| **Port (optional)** | nur bei abweichendem Port setzen |
| **Abfrageintervall** | Sekunden zwischen zwei Abfragen (min. 5, Standard 30) |
| **Nutzbare Kapazität (Wh)** | optional; wird sonst automatisch geschätzt |
| **… melden** | einzelne Geräte (Batterie/PV/Netz/Verbrauch) ein-/ausblenden |

Nach dem Speichern wechselt der Status auf **„Bereit"**, sobald die Batterie
erreichbar ist. Die vier Geräte lassen sich anschließend wie normale
Homematic IP Geräte einbinden und in Diagrammen/Automatisierungen nutzen.

---

## 6. Vorzeichen-Konventionen

Damit die Werte in Homematic IP eindeutig sind:

- **Batterie-Leistung**: positiv = **lädt**, negativ = **entlädt**.
- **Netz-Leistung**: positiv = **Bezug aus dem Netz**, negativ = **Einspeisung**.
- **PV-Erzeugung** und **Hausverbrauch**: immer ≥ 0.
- **Ladezustand**: `batteryLevel` = `USOC/100` (0–1), Anzeige in Prozent.

---

## 7. Lokales Entwickeln (optional)

Ohne Container, direkt auf dem Entwicklungsrechner:

1. HCU-Authorization-Token besorgen: in HCUweb (Entwicklermodus) einen
   **Aktivierungsschlüssel** erzeugen und gemäß Connect-API-Doku
   (`connect-api-main/connect-api-documentation-1.0.1.html`, Kapitel
   „Requesting an authorization token") gegen einen `authToken` tauschen.
   Token in `plugin/authtoken.txt` speichern.
2. Abhängigkeiten installieren und starten:

   ```bash
   cd plugin
   npm install
   node src/index.js de.community.homematic.plugin.sonnen <hcu-host> authtoken.txt
   ```

   `<hcu-host>` ist z. B. `hcu1-XXXX.local`.
3. Konfiguration ohne HCUweb: Datei `plugin/data/config.json` anlegen
   (siehe `SONNEN_CONFIG_PATH`), z. B.:

   ```json
   {
     "sonnenHost": "192.168.1.50",
     "sonnenApiVersion": "V2",
     "sonnenToken": "DEIN_TOKEN",
     "pollIntervalSeconds": 30
   }
   ```

### Dashboard lokal ansehen

```bash
cd frontend
npm install
npm run dev
```

Der Vite-Dev-Server proxied `/api` auf `http://localhost:8090` (das laufende
Plugin). Im gebauten Container wird das Dashboard vom Plugin selbst unter dem
konfigurierten Port (Standard **8090**) ausgeliefert.

---

## 8. Projektstruktur

```
HCU_Sonnen/
├─ plugin/                 Node.js-Plugin (Backend)
│  ├─ src/
│  │  ├─ index.js          Einstiegspunkt, verdrahtet alles
│  │  ├─ hcuClient.js      WebSocket + Connect-API-Protokoll
│  │  ├─ sonnenClient.js   REST-Client der sonnenBatterie
│  │  ├─ deviceMapper.js   Sonnen-Daten → HCU-Geräte/Features
│  │  ├─ config.js         Konfig-Template, Persistenz, Update
│  │  ├─ dashboard.js      eingebetteter HTTP-Server (State-API + UI)
│  │  └─ logger.js
│  └─ package.json
├─ frontend/               React + Vite Dashboard
├─ Dockerfile              Multi-Stage-Build (Frontend + ARM64-Runtime)
├─ build.ps1 / build.sh    Build- und Export-Skripte
├─ docs/KONZEPT.md         Ausführliches Umsetzungskonzept
└─ connect-api-main/       Offizielle Connect-API-Doku & Beispiele
```

---

## 9. Fehlersuche

| Symptom | Ursache / Lösung |
| --- | --- |
| Status „Konfiguration erforderlich" | IP-Adresse und (bei V2) Token eintragen. |
| Status „Fehler" | Batterie nicht erreichbar. IP, Port, Token, Netzwerk prüfen. Plugin-Logs in HCUweb ansehen. |
| Keine WebSocket-Verbindung | Entwicklermodus in der HCU aktiviert? HCU erreichbar? |
| `HTTP 401`/`403` von der Batterie | Token ungültig oder API V2 ohne Token. |
| Werte wirken „falsch herum" | Vorzeichen-Konventionen aus Abschnitt 6 beachten. |

Log-Level über die Umgebungsvariable `LOG_LEVEL` (`error` | `warn` | `info` |
`debug`) steuerbar.

---

## Lizenz

MIT. Homematic IP ist eine Marke der eQ-3 AG. „sonnen" ist eine Marke der
Sonnen GmbH. Dieses Community-Projekt steht in keiner Verbindung zu eQ-3 oder
Sonnen.
