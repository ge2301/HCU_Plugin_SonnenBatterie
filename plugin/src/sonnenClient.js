"use strict";

const http = require("http");
const logger = require("./logger");

/**
 * REST client for the local sonnenBatterie API.
 *
 * Two API generations are supported:
 *   - "V2" (default): http://<host>:80/api/v2/status, authenticated with the
 *     "Auth-Token" header (the read token generated in the sonnen web UI).
 *   - "V1" (legacy):  http://<host>:8080/api/v1/status, no authentication.
 *
 * The raw sonnen payload is normalised into a stable shape that the rest of the
 * plugin consumes, so sign conventions and field names only live in one place.
 *
 * Sonnen sign conventions (as returned by the battery):
 *   - Pac_total_W : positive => battery is DISCHARGING, negative => CHARGING
 *   - GridFeedIn_W: positive => FEED-IN to grid (export), negative => PURCHASE (import)
 *   - Production_W: PV production (>= 0)
 *   - Consumption_W: household consumption (>= 0)
 *
 * Normalised conventions exposed to the HCU (documented for users):
 *   - batteryChargePowerW : positive => charging, negative => discharging
 *   - gridImportPowerW     : positive => import from grid, negative => export to grid
 *   - productionW / consumptionW : always >= 0
 */

const DEFAULTS = {
	V2: { port: 80, path: "/api/v2/status" },
	V1: { port: 8080, path: "/api/v1/status" },
};

function httpGetJson({ host, port, path, headers, timeoutMs }) {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ host, port, path, method: "GET", headers, timeout: timeoutMs },
			(res) => {
				const chunks = [];
				res.on("data", (c) => chunks.push(c));
				res.on("end", () => {
					const bodyText = Buffer.concat(chunks).toString("utf8");
					if (res.statusCode < 200 || res.statusCode >= 300) {
						reject(new Error(`HTTP ${res.statusCode} from ${host}:${port}${path} - ${bodyText.slice(0, 200)}`));
						return;
					}
					try {
						resolve(JSON.parse(bodyText));
					} catch (err) {
						reject(new Error(`Invalid JSON from ${host}:${port}${path}: ${err.message}`));
					}
				});
			}
		);
		req.on("timeout", () => req.destroy(new Error(`Request to ${host}:${port}${path} timed out`)));
		req.on("error", reject);
		req.end();
	});
}

function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/**
 * Normalise a raw sonnen /status payload (V1 and V2 share these field names).
 */
function normalize(raw) {
	const productionW = num(raw.Production_W);
	const consumptionW = num(raw.Consumption_W);
	const gridFeedInW = num(raw.GridFeedIn_W);
	const pacTotalW = num(raw.Pac_total_W);
	const usoc = num(raw.USOC);
	const rsoc = num(raw.RSOC);
	const remainingWh = num(raw.RemainingCapacity_Wh);

	return {
		raw,
		online: true,
		timestamp: raw.Timestamp || new Date().toISOString(),
		systemStatus: raw.SystemStatus || null,
		// Household + PV
		productionW: productionW != null ? Math.max(0, productionW) : null,
		consumptionW: consumptionW != null ? Math.max(0, consumptionW) : null,
		// Grid: convert sonnen "feed-in positive" into "import positive"
		gridImportPowerW: gridFeedInW != null ? -gridFeedInW : null,
		// Battery: convert sonnen "discharge positive" into "charge positive"
		batteryChargePowerW: pacTotalW != null ? -pacTotalW : null,
		batteryCharging: raw.BatteryCharging === true,
		batteryDischarging: raw.BatteryDischarging === true,
		// State of charge: USOC is the user-facing value, fall back to RSOC
		usoc,
		rsoc,
		stateOfChargePercent: usoc != null ? usoc : rsoc,
		// remainingCapacityWh from the API is the physical BMS value, not corrected
		// for usable capacity limits. We keep it as rawRemainingCapacityWh and will
		// compute the corrected value in deviceMapper once we know the usable capacity.
		rawRemainingCapacityWh: remainingWh,
	};
}

/**
 * Fetch battery metadata from /api/v2/battery endpoint.
 * Returns the capacity in Wh (Capacity_Wh field) if available.
 */
async function fetchBattery(config) {
	const version = (config.sonnenApiVersion || "V2").toUpperCase();
	const port = config.sonnenPort || DEFAULTS.V2.port;
	const headers = {};
	if (version === "V2" && config.sonnenToken) {
		headers["Auth-Token"] = config.sonnenToken;
	}

	try {
		const raw = await httpGetJson({
			host: config.sonnenHost,
			port,
			path: "/api/v2/battery",
			headers,
			timeoutMs: 8000,
		});
		const capacityWh = num(raw.Capacity_Wh);
		logger.debug(`Battery capacity from /api/v2/battery: ${capacityWh} Wh`);
		return capacityWh;
	} catch (err) {
		logger.warn(`Could not fetch battery info from /api/v2/battery: ${err.message}`);
		return null;
	}
}

/**
 * Fetch both /status and /battery endpoints and merge the results.
 * The /battery endpoint provides the correct Capacity_Wh which is needed
 * for accurate battery capacity reporting to Homematic IP.
 */
async function fetchStatus(config) {
	const [status, batteryCapacityWh] = await Promise.all([
		fetchStatusRaw(config),
		fetchBattery(config),
	]);

	if (batteryCapacityWh != null) {
		status.batteryCapacityWh = batteryCapacityWh;
	}

	// Compute corrected remaining capacity based on usable capacity and USOC.
	// The raw RemainingCapacity_Wh from the API is the physical BMS value, not
	// corrected for usable capacity limits. We compute the user-facing value as:
	// remainingCapacityWh = usableCapacity * (USOC / 100)
	const usableCapacity = batteryCapacityWh != null ? batteryCapacityWh : config.batteryCapacityWh;
	if (usableCapacity && status.usoc != null) {
		status.remainingCapacityWh = Math.round(usableCapacity * (status.usoc / 100));
	} else if (status.rawRemainingCapacityWh != null) {
		// Fallback to raw value if we can't compute the corrected one
		status.remainingCapacityWh = status.rawRemainingCapacityWh;
	}

	return status;
}

async function fetchStatusRaw(config) {
	const version = (config.sonnenApiVersion || "V2").toUpperCase();
	const preset = DEFAULTS[version] || DEFAULTS.V2;
	const port = config.sonnenPort || preset.port;
	const headers = {};
	if (version === "V2" && config.sonnenToken) {
		headers["Auth-Token"] = config.sonnenToken;
	}

	logger.debug(`Fetching sonnen status from ${config.sonnenHost}:${port}${preset.path} (${version})`);
	const raw = await httpGetJson({
		host: config.sonnenHost,
		port,
		path: preset.path,
		headers,
		timeoutMs: 8000,
	});
	return normalize(raw);
}

module.exports = { fetchStatus, fetchBattery, normalize };
