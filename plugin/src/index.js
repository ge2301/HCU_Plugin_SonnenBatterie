"use strict";

const fs = require("fs").promises;
const logger = require("./logger");
const configModule = require("./config");
const sonnenClient = require("./sonnenClient");
const deviceMapper = require("./deviceMapper");
const HcuClient = require("./hcuClient");
const { startDashboard } = require("./dashboard");

/**
 * Entry point.
 *
 * Command line arguments (as provided by the Dockerfile ENTRYPOINT):
 *   argv[2] = pluginId
 *   argv[3] = HCU host (e.g. host.containers.internal on the HCU)
 *   argv[4] = path to the auth token file (e.g. /TOKEN)
 */
async function main() {
	const [, , pluginId, host, authTokenFile] = process.argv;
	if (!pluginId || !host || !authTokenFile) {
		logger.error("Usage: node src/index.js <pluginId> <hcuHost> <authTokenFile>");
		process.exit(1);
	}

	const authToken = (await fs.readFile(authTokenFile, "utf8")).trim();

	// Mutable runtime state -------------------------------------------------
	let config = configModule.load();
	let lastStatus = null; // last successful normalised sonnen status
	let lastError = null; // last poll error message
	let pollTimer = null;

	// Derived helpers -------------------------------------------------------
	function currentReadiness() {
		if (!configModule.isConfigured(config)) return "CONFIG_REQUIRED";
		if (lastStatus == null && lastError != null) return "ERROR";
		return "READY";
	}

	function currentDevices() {
		// Fall back to an "offline" status so devices still appear in discovery.
		const status = lastStatus || { online: false };
		return deviceMapper.buildDevices(status, config);
	}

	function dashboardState() {
		return {
			plugin: {
				pluginId,
				readiness: currentReadiness(),
				configured: configModule.isConfigured(config),
				connectedToHcu: hcu ? hcu.connected : false,
				lastError,
				lastUpdate: lastStatus ? lastStatus.timestamp : null,
			},
			config: configModule.redact(config),
			status: lastStatus,
		};
	}

	// HCU client ------------------------------------------------------------
	const hcu = new HcuClient({
		pluginId,
		host,
		authToken,
		callbacks: {
			getReadiness: currentReadiness,
			getDevices: currentDevices,
			getConfigTemplate: () => configModule.buildTemplate(config),
			onConfigUpdate: async (properties) => {
				config = configModule.applyUpdate(config, properties);
				configModule.save(config);
				logger.info("Configuration updated via HCU");
				restartPolling();
				// Trigger an immediate poll so devices update quickly.
				await pollOnce();
				if (!configModule.isConfigured(config)) {
					return { status: "APPLIED", message: "Bitte IP-Adresse und Token der sonnenBatterie angeben." };
				}
				if (lastError) {
					return { status: "APPLIED", message: `Konfiguration gespeichert, aber Batterie nicht erreichbar: ${lastError}` };
				}
				return { status: "APPLIED", message: "Verbindung zur sonnenBatterie erfolgreich." };
			},
		},
	});

	// Polling ---------------------------------------------------------------
	async function pollOnce() {
		if (!configModule.isConfigured(config)) {
			logger.debug("Skipping poll: plugin not configured yet");
			return;
		}
		try {
			const status = await sonnenClient.fetchStatus(config);
			lastStatus = status;
			lastError = null;
			const events = deviceMapper.buildStatusEvents(status, config);
			hcu.sendStatusEvents(events);
			logger.info(
				`Sonnen update: SOC ${status.stateOfChargePercent}% | PV ${status.productionW}W | ` +
					`Verbrauch ${status.consumptionW}W | Netz ${status.gridImportPowerW}W | Batterie ${status.batteryChargePowerW}W`
			);
		} catch (err) {
			lastError = err.message;
			logger.error(`Failed to poll sonnenBatterie: ${err.message}`);
			hcu.pushReadiness();
		}
	}

	function restartPolling() {
		if (pollTimer) clearInterval(pollTimer);
		const intervalMs = Math.max(5, config.pollIntervalSeconds || 30) * 1000;
		pollTimer = setInterval(pollOnce, intervalMs);
		logger.info(`Polling every ${intervalMs / 1000}s`);
	}

	// Dashboard -------------------------------------------------------------
	startDashboard({ port: config.dashboardPort || 8090, getState: dashboardState });

	// Start -----------------------------------------------------------------
	hcu.connect();
	restartPolling();
	await pollOnce();

	// Graceful shutdown -----------------------------------------------------
	function shutdown() {
		logger.info("Shutting down plugin");
		if (pollTimer) clearInterval(pollTimer);
		hcu.stop();
		process.exit(0);
	}
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

main().catch((err) => {
	logger.error(`Fatal error: ${err.stack || err.message}`);
	process.exit(1);
});
