"use strict";

const fs = require("fs");
const path = require("path");
const logger = require("./logger");

/**
 * Configuration handling for the plugin.
 *
 * The HCU stores the user configuration and delivers it via CONFIG_UPDATE_REQUEST
 * whenever the user saves the form in HCUweb. We persist the last known values to
 * disk so that the plugin can:
 *   1. keep running with the correct settings after a container restart, and
 *   2. pre-fill the configuration form (currentValue) on CONFIG_TEMPLATE_REQUEST.
 *
 * Persistence is best effort. If the container's writable layer is reset by the
 * HCU, the plugin falls back to CONFIG_REQUIRED until the user saves again.
 */

const CONFIG_PATH = process.env.SONNEN_CONFIG_PATH || "/app/data/config.json";

const DEFAULT_CONFIG = {
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
	dashboardPort: 5200,
};

function load() {
	try {
		if (fs.existsSync(CONFIG_PATH)) {
			const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
			logger.info(`Loaded persisted configuration from ${CONFIG_PATH}`);
			return { ...DEFAULT_CONFIG, ...parsed };
		}
	} catch (err) {
		logger.warn(`Could not read config file ${CONFIG_PATH}: ${err.message}`);
	}
	return { ...DEFAULT_CONFIG };
}

function save(config) {
	try {
		fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
		logger.info(`Persisted configuration to ${CONFIG_PATH}`);
	} catch (err) {
		logger.warn(`Could not persist config file ${CONFIG_PATH}: ${err.message}`);
	}
}

function isConfigured(config) {
	if (!config.sonnenHost) return false;
	if ((config.sonnenApiVersion || "V2").toUpperCase() === "V2" && !config.sonnenToken) return false;
	return true;
}

/**
 * Applies a CONFIG_UPDATE_REQUEST body's "properties" map onto the config,
 * coercing values into the correct types.
 */
function applyUpdate(config, properties) {
	const next = { ...config };
	const map = properties || {};

	if (map.sonnenHost !== undefined) next.sonnenHost = String(map.sonnenHost).trim();
	if (map.sonnenApiVersion !== undefined) next.sonnenApiVersion = String(map.sonnenApiVersion).toUpperCase();
	if (map.sonnenToken !== undefined) next.sonnenToken = String(map.sonnenToken).trim();
	if (map.sonnenPort !== undefined && map.sonnenPort !== "") next.sonnenPort = Number(map.sonnenPort) || null;
	if (map.pollIntervalSeconds !== undefined) next.pollIntervalSeconds = Math.max(5, Number(map.pollIntervalSeconds) || 30);
	if (map.batteryCapacityWh !== undefined && map.batteryCapacityWh !== "") next.batteryCapacityWh = Number(map.batteryCapacityWh) || null;
	if (map.exposeBattery !== undefined) next.exposeBattery = Boolean(map.exposeBattery);
	if (map.exposeInverter !== undefined) next.exposeInverter = Boolean(map.exposeInverter);
	if (map.exposeGrid !== undefined) next.exposeGrid = Boolean(map.exposeGrid);
	if (map.exposeConsumption !== undefined) next.exposeConsumption = Boolean(map.exposeConsumption);

	return next;
}

/**
 * Builds the CONFIG_TEMPLATE_RESPONSE body describing the configuration form
 * that HCUweb renders for the user.
 *
 * @param {object} config - current configuration
 * @param {string} [hcuHostname] - HCU hostname for the dashboard link (optional, for HCU mode)
 */
function buildTemplate(config, hcuHostname) {
	// Pre-compute the dashboard URL for the WEBLINK field.
	const dashboardUrl = hcuHostname ? `http://${hcuHostname}:5200` : "http://<HCU-Adresse>:5200";

	const groups = {
		connection: { friendlyName: "Verbindung", description: "Zugang zur sonnenBatterie im lokalen Netzwerk.", order: 1 },
		battery: { friendlyName: "Batterie", description: "Angaben zur Batterie.", order: 2 },
		devices: { friendlyName: "Geräte", description: "Welche Werte an Homematic IP gemeldet werden.", order: 3 },
		info: { friendlyName: "Info", description: "Hinweise und Links.", order: 4 },
	};

	const properties = {
		sonnenHost: {
			dataType: "STRING",
			friendlyName: "IP-Adresse der sonnenBatterie",
			description: "Lokale IP-Adresse der sonnenBatterie, z. B. 192.168.1.50.",
			groupId: "connection",
			required: "true",
			order: 1,
			currentValue: config.sonnenHost || "",
		},
		sonnenApiVersion: {
			dataType: "ENUM",
			friendlyName: "API-Version",
			description: "V2 (Standard, Token erforderlich) oder V1 (Legacy, Port 8080, kein Token).",
			groupId: "connection",
			values: ["V2", "V1"],
			defaultValue: "V2",
			order: 2,
			currentValue: config.sonnenApiVersion || "V2",
		},
		sonnenToken: {
			dataType: "STRING",
			friendlyName: "API Read-Token",
			description: "Im sonnen Web-Interface generierter Read-Token (nur für API V2 nötig).",
			groupId: "connection",
			order: 3,
			currentValue: config.sonnenToken || "",
		},
		sonnenPort: {
			dataType: "INTEGER",
			friendlyName: "Port (optional)",
			description: "Nur setzen, wenn ein abweichender Port genutzt wird. Standard: 80 (V2) bzw. 8080 (V1).",
			groupId: "connection",
			minimum: 1,
			maximum: 65535,
			order: 4,
			currentValue: config.sonnenPort != null ? String(config.sonnenPort) : "",
		},
		pollIntervalSeconds: {
			dataType: "INTEGER",
			friendlyName: "Abfrageintervall (Sekunden)",
			description: "Wie oft die Batterie abgefragt wird. Minimum 5 Sekunden.",
			groupId: "connection",
			minimum: 5,
			maximum: 3600,
			defaultValue: "30",
			order: 5,
			currentValue: String(config.pollIntervalSeconds || 30),
		},
		batteryCapacityWh: {
			dataType: "INTEGER",
			friendlyName: "Nutzbare Kapazität (Wh, optional)",
			description: "Optional. Wird automatisch geschätzt, wenn leer gelassen.",
			groupId: "battery",
			minimum: 0,
			maximum: 1000000,
			order: 1,
			currentValue: config.batteryCapacityWh != null ? String(config.batteryCapacityWh) : "",
		},
		exposeBattery: {
			dataType: "BOOLEAN",
			friendlyName: "Batterie melden",
			description: "Ladezustand und Lade-/Entladeleistung als BATTERY-Gerät.",
			groupId: "devices",
			defaultValue: "true",
			order: 1,
			currentValue: String(config.exposeBattery !== false),
		},
		exposeInverter: {
			dataType: "BOOLEAN",
			friendlyName: "PV-Erzeugung melden",
			description: "Aktuelle PV-Leistung als INVERTER-Gerät.",
			groupId: "devices",
			defaultValue: "true",
			order: 2,
			currentValue: String(config.exposeInverter !== false),
		},
		exposeGrid: {
			dataType: "BOOLEAN",
			friendlyName: "Netzanschluss melden",
			description: "Netzbezug/-einspeisung als GRID_CONNECTION_POINT-Gerät.",
			groupId: "devices",
			defaultValue: "true",
			order: 3,
			currentValue: String(config.exposeGrid !== false),
		},
		exposeConsumption: {
			dataType: "BOOLEAN",
			friendlyName: "Hausverbrauch melden",
			description: "Aktueller Hausverbrauch als ENERGY_METER-Gerät.",
			groupId: "devices",
			defaultValue: "true",
			order: 4,
			currentValue: String(config.exposeConsumption !== false),
		},
		dashboardUrl: {
			dataType: "WEBLINK",
			friendlyName: "Dashboard",
			description: "Direkter Link zum Live-Dashboard.",
			groupId: "info",
			order: 1,
			currentValue: dashboardUrl,
			defaultValue: "Dashboard öffnen",
		},
	};

	return { groups, properties };
}

/**
 * Returns a copy of the config safe for exposing over the dashboard API
 * (the token is masked).
 */
function redact(config) {
	return { ...config, sonnenToken: config.sonnenToken ? "***" : "" };
}

module.exports = {
	CONFIG_PATH,
	DEFAULT_CONFIG,
	load,
	save,
	isConfigured,
	applyUpdate,
	buildTemplate,
	redact,
};
