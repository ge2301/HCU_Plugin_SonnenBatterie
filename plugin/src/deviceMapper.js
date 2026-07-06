"use strict";

/**
 * Maps the normalised sonnen status into Homematic IP Connect API devices and
 * feature updates.
 *
 * Device archetypes used (see Connect API "DeviceType"):
 *   - BATTERY               -> the sonnenBatterie itself (BatteryState + CurrentPower)
 *   - INVERTER              -> PV production          (CurrentPower)
 *   - GRID_CONNECTION_POINT -> grid import/export     (CurrentPower)
 *   - ENERGY_METER          -> household consumption  (CurrentPower)
 *
 * All devices are read-only; the plugin never controls the battery.
 */

const DEVICE_IDS = {
	battery: "sonnen-battery",
	inverter: "sonnen-inverter",
	grid: "sonnen-grid",
	consumption: "sonnen-consumption",
};

const MODEL_TYPE = "sonnenBatterie";
const FIRMWARE = "1.0.0";

function round(value, digits = 0) {
	if (value == null || !Number.isFinite(value)) return null;
	const f = Math.pow(10, digits);
	return Math.round(value * f) / f;
}

/**
 * Determine the usable battery capacity in Wh.
 * Priority: explicit config value -> derived from remaining capacity and SOC.
 */
function resolveBatteryCapacityWh(status, config) {
	if (config.batteryCapacityWh && Number(config.batteryCapacityWh) > 0) {
		return Number(config.batteryCapacityWh);
	}
	if (status.remainingCapacityWh != null && status.stateOfChargePercent > 0) {
		return round(status.remainingCapacityWh / (status.stateOfChargePercent / 100));
	}
	return null;
}

function batteryFeatures(status, config) {
	const features = [];
	const capacity = resolveBatteryCapacityWh(status, config);
	const soc = status.stateOfChargePercent;

	const batteryState = { type: "batteryState" };
	if (soc != null) batteryState.batteryLevel = round(Math.min(100, Math.max(0, soc)) / 100, 4);
	if (capacity != null) batteryState.batteryCapacity = capacity;
	features.push(batteryState);

	if (status.batteryChargePowerW != null) {
		features.push({ type: "currentPower", currentPower: round(status.batteryChargePowerW) });
	}
	return features;
}

function inverterFeatures(status) {
	if (status.productionW == null) return [];
	return [{ type: "currentPower", currentPower: round(status.productionW) }];
}

function gridFeatures(status) {
	if (status.gridImportPowerW == null) return [];
	return [{ type: "currentPower", currentPower: round(status.gridImportPowerW) }];
}

function consumptionFeatures(status) {
	if (status.consumptionW == null) return [];
	return [{ type: "currentPower", currentPower: round(status.consumptionW) }];
}

/**
 * Returns the list of enabled device descriptors along with their current
 * feature values. Used for DISCOVER_RESPONSE and STATUS_RESPONSE.
 */
function buildDevices(status, config) {
	const devices = [];

	if (config.exposeBattery !== false) {
		devices.push({
			deviceId: DEVICE_IDS.battery,
			deviceType: "BATTERY",
			modelType: MODEL_TYPE,
			firmwareVersion: FIRMWARE,
			friendlyName: "sonnenBatterie",
			features: batteryFeatures(status, config),
		});
	}
	if (config.exposeInverter !== false) {
		devices.push({
			deviceId: DEVICE_IDS.inverter,
			deviceType: "INVERTER",
			modelType: MODEL_TYPE,
			firmwareVersion: FIRMWARE,
			friendlyName: "Sonnen PV-Erzeugung",
			features: inverterFeatures(status),
		});
	}
	if (config.exposeGrid !== false) {
		devices.push({
			deviceId: DEVICE_IDS.grid,
			deviceType: "GRID_CONNECTION_POINT",
			modelType: MODEL_TYPE,
			firmwareVersion: FIRMWARE,
			friendlyName: "Sonnen Netzanschluss",
			features: gridFeatures(status),
		});
	}
	if (config.exposeConsumption !== false) {
		devices.push({
			deviceId: DEVICE_IDS.consumption,
			deviceType: "ENERGY_METER",
			modelType: MODEL_TYPE,
			firmwareVersion: FIRMWARE,
			friendlyName: "Sonnen Hausverbrauch",
			features: consumptionFeatures(status),
		});
	}

	return devices;
}

/**
 * Returns per-device partial feature updates for STATUS_EVENT messages.
 */
function buildStatusEvents(status, config) {
	return buildDevices(status, config)
		.filter((d) => d.features.length > 0)
		.map((d) => ({ deviceId: d.deviceId, features: d.features }));
}

module.exports = { buildDevices, buildStatusEvents, DEVICE_IDS };
